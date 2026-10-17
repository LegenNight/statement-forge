/**
 * Gumroad License Proxy — Next.js Edge Route Handler
 *
 * Thin pass-through to https://api.gumroad.com/v2/licenses/verify
 * Exists solely to bypass browser CORS restrictions on the Gumroad API.
 * No business logic, no state, no database.
 */
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { licenseKey, productPermalink } = await req.json();

    if (!licenseKey || !productPermalink) {
      return Response.json(
        { success: false, message: 'Missing licenseKey or productPermalink' },
        { status: 400 }
      );
    }

    const gumroadRes = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        license_key: licenseKey,
        product_permalink: productPermalink,
      }),
    });

    const data = await gumroadRes.json();
    return Response.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json(
      { success: false, message: `Proxy error: ${message}` },
      { status: 500 }
    );
  }
}
