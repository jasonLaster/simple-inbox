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

const query = `
query recs {
recordings(limit: 100, where:{workspace_id:{_eq:"ee16d7da-5f6e-4d6e-ad5e-09845d29112b"}}) {
    id
}
}
`;

async function queryGraphQL(query: string) {
  const queryRes = await fetch(hasuraUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": hasuraKey,
    },
    body: JSON.stringify({
      query: query,
      name: "recordings",
    }),
  });

  return await queryRes.json();
}

async function insertRecordings(ids: RecordingIds) {
  const insertRes = await fetch(hasuraUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": hasuraKey,
    },
    body: JSON.stringify({
      query: `
      mutation insertRecordings($recordings: [recordings_insert_input!]!) {
        insert_recordings(objects: $recordings) {
          affected_rows
        }
      }
      `,
      variables: {
        ids: ids,
      },
    }),
  });

  return await insertRes.json();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const {
    data: { recordings },
  } = await queryGraphQL(`
  query recs {
    recordings(
        limit: 100, 
        where: { workspace_id: {_eq: "ee16d7da-5f6e-4d6e-ad5e-09845d29112b" } }
    ) {
      id
    }
  }`);

  res.status(200).json(recordings);
}
