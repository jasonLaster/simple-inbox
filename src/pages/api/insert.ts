// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";

// @ts-ignore
import fetch from "node-fetch";

const hasuraKey = process.env.hasuraKey;
const hasuraUrl = process.env.hasuraUrl;

type Data = {
  name: string;
};

type RecordingIds = { recording_id: string }[];

async function insertRecordings(ids: RecordingIds) {
  const insertRes = await fetch(hasuraUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": hasuraKey,
    },
    body: JSON.stringify({
      query: `
      mutation insertRecordings($recordings: [simple_inbox_insert_input!]!) {
        insert_simple_inbox(objects: $recordings) {
          affected_rows
        }
      }
      `,
      variables: {
        recordings: ids,
      },
    }),
  });

  return await insertRes.json();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const recordings = await insertRecordings([
    { recording_id: "7bb3eee7-2f28-4fc9-8c17-8f39ca98ca21" },
    { recording_id: "de12d8bb-a204-403a-b5e6-8b64e334b277" },
    { recording_id: "37521309-38af-4578-99cc-4573d5236d56" },
    { recording_id: "20c980ff-b372-4225-a126-bd58433abf7c" },
    { recording_id: "2d3b4150-91ec-4337-abfa-4a678b6aae32" },
  ]);
  res.status(200).json(recordings);
}
