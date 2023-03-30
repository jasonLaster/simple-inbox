// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";

// @ts-ignore
import fetch from "node-fetch";
import { createClient } from "../../utils/protocol";

const apiKey = process.env.apiKey as string;
const hasuraKey = process.env.hasuraKey;
const hasuraUrl = process.env.hasuraUrl;
const dispatchURL = process.env.dispatchURL;

type Data = {
  error?: string;
  results?: any[];
};

async function queryGraphQL(query: string, variables: any = {}) {
  const queryRes = await fetch(hasuraUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": hasuraKey,
    },
    body: JSON.stringify({
      query,
      name: "recordings",
      variables,
    }),
  });

  return await queryRes.json();
}

async function processRecording(recordingId: string) {
  return new Promise(async (resolve, reject) => {
    let released = false;

    try {
      const { client } = await createClient({ address: dispatchURL });
      await client.Authentication.setAccessToken({ accessToken: apiKey });

      const { sessionId } = await client.Recording.createSession({
        recordingId,
      });
      console.log(`sessionId: ${sessionId}`);
      setTimeout(() => {
        if (!released) {
          console.log(`>> Session timed out:`, { recordingId, sessionId });
          client.Recording.releaseSession({ sessionId });
          resolve(false);
        }
      }, 30_000);

      // let loaded;
      client.Session.addLoadedRegionsListener(async (loadedRegions: any) => {
        if (
          !loadedRegions.loading[0] ||
          !loadedRegions.loaded[0] ||
          !loadedRegions.indexed[0]
        ) {
          return;
        }
        const loading = `${loadedRegions.loading[0].begin.time}-${loadedRegions.loading[0].end.time}`;
        const loaded = `${loadedRegions.loaded[0].begin.time}-${loadedRegions.loaded[0].end.time}`;
        const indexed = `${loadedRegions.indexed[0].begin.time}-${loadedRegions.indexed[0].end.time}`;

        console.log(">> loadedRegions", { loading, loaded, indexed });
        if (loaded == loading && indexed == loaded) {
          client.Recording.releaseSession({ sessionId });
          resolve(true);
        }
        //   console.log(">> loadedRegions", JSON.stringify(loadedRegion));
      });

      client.Session.listenForLoadChanges({}, sessionId).catch(() => {});

      released = true;
      console.log("Session released");
    } catch (e) {
      console.log(">> error", e);
    } finally {
    }
  });
}

function updateRecordingsStatus(recordingIds: string[], status: number) {
  return queryGraphQL(
    `mutation ProcessRecording($recordingIds: [uuid!]!, $status: Int!) {
            update_simple_inbox(
              where:{recording_id:{_in: $recordingIds}}
                _set:{status: $status}  
            ) {
              returning {
                recording_id
              }
            }
          }
    `,
    {
      recordingIds,
      status,
    }
  );
}

async function getRecordingsWithStatus(status: number, limit: number) {
  const { data } = await queryGraphQL(
    `
      query GetUnprocessedRecordings($limit: Int!, $status: Int!) {
        simple_inbox(limit: $limit, where:{status:{_eq: $status}}) {
          recording_id
        }
      }`,
    {
      limit,
      status,
    }
  );
  const recordingIds = data.simple_inbox.map((rec: any) => rec.recording_id);
  return recordingIds;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  console.log(">> starting");
  const unprocessedRecordings = await getRecordingsWithStatus(1, 5);
  const processingRecordings = await getRecordingsWithStatus(2, 100);

  if (processingRecordings.length > 20) {
    console.log(">> too many recordings processing");
    res.status(200).json({ error: "too many recordings processing" });
  }

  console.log(">> recordings", unprocessedRecordings);

  if (unprocessedRecordings.length === 0) {
    console.log(">> no recordings to process");
    res.status(200).json({ error: "no recordings to process" });
    return;
  }
  await updateRecordingsStatus(unprocessedRecordings, 2);

  let results: any = [];
  await Promise.all(
    unprocessedRecordings.map(async (recordingId: string) => {
      const result = await processRecording(recordingId);
      await updateRecordingsStatus([recordingId], result ? 3 : 4);
      results.push({ recordingId, result });
      console.log(`>>> result: ${result}`);
    })
  );

  res.status(200).json({ results });
}
