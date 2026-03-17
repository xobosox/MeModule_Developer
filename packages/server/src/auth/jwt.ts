import * as jose from "jose";

export interface TokenPayload {
  userId: string;
  address: string;
}

export async function createToken(
  payload: TokenPayload,
  secret: string,
  expiresIn = "7d"
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<TokenPayload> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jose.jwtVerify(token, key);
  return payload as unknown as TokenPayload;
}
