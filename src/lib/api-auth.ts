import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export type AuthSuccess = {
  uid: string;
};

export type AuthFailure = {
  errorResponse: NextResponse;
};

export const requireUserFromBearerToken = async (
  authorizationHeader: string | null
): Promise<AuthSuccess | AuthFailure> => {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return {
      errorResponse: NextResponse.json({ error: 'Missing Authorization header.' }, { status: 401 }),
    };
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();
  if (!token) {
    return {
      errorResponse: NextResponse.json({ error: 'Invalid Authorization token.' }, { status: 401 }),
    };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return {
      errorResponse: NextResponse.json({ error: 'Unauthorized request.' }, { status: 401 }),
    };
  }
};
