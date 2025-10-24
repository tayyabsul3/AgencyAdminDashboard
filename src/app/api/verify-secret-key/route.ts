import { NextResponse } from 'next/server';
import { auth, db } from '@/lib/Firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    // Get the current user
    const user = auth.currentUser;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { secretKey, clientId } = body;

    if (!secretKey || !clientId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get agency data
    const agencyDoc = await getDoc(doc(db, 'agencies', user.uid));
    if (!agencyDoc.exists()) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
    }

    // Verify the secret key matches the agency's stored key
    const agencyData = agencyDoc.data();
    if (agencyData.passwordSecretKey !== secretKey) {
      return NextResponse.json({ error: 'Invalid secret key' }, { status: 401 });
    }

    // Check if the client belongs to this agency
    if (!agencyData.clients?.includes(clientId)) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error('Error verifying secret key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}