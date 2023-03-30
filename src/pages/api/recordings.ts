// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";

// @ts-ignore
import fetch from "node-fetch";

const hasuraKey = process.env.hasuraKey;
const hasuraUrl = process.env.hasuraUrl;

type Data = {
  name: string;
};

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

  const res = await queryRes.json();
  return res;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const { data } = await queryGraphQL(`
  query recs {
    simple_inbox(limit: 100) {
      id
      status
      recording {
        url 
      }
    }
  }`);

  res.status(200).json(data);
}
