import { UTApi } from "uploadthing/server";
import {NextRequest, NextResponse} from "next/server";

const utapi = new UTApi();

export async function POST(req: NextRequest) {
    const { fileKey } = await req.json();
    if (!fileKey) {
        return NextResponse.json({ error: "No file key" }, { status: 400 });
    }

    try {
        await utapi.deleteFiles(fileKey);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting file from UploadThing:", error);
        return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
    }
}
