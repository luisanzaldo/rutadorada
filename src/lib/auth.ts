import { SignJWT, jwtVerify } from 'jose';

/**
 * Helper to obtain the JWT_SECRET from environment variables safely.
 */
function getSecretKey(): Uint8Array {
  // Support both Node.js process.env and Vite's import.meta.env
  const secret = import.meta.env.JWT_SECRET || process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('Missing JWT_SECRET environment variable.');
  }
  
  return new TextEncoder().encode(secret);
}

/**
 * Generates a signed JWT for the given username, expiring in 7 days.
 */
export async function createSession(username: string): Promise<string> {
  const secretKey = getSecretKey();
  
  const token = await new SignJWT({ username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);
    
  return token;
}

/**
 * Verifies and decodes a JWT token. Returns the payload if valid, or null otherwise.
 */
export async function verifySession(token: string): Promise<any | null> {
  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (error) {
    // Return null if token is expired, invalid, or malformed
    return null;
  }
}

/**
 * Extracts the 'session' cookie from a Request object and verifies it.
 */
export async function getSession(request: Request): Promise<any | null> {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  // Parse the cookies to find 'session'
  const match = cookieHeader.match(/(?:^|;)\s*session=([^;]*)/);
  if (!match || !match[1]) {
    return null;
  }

  const token = match[1];
  return verifySession(token);
}
