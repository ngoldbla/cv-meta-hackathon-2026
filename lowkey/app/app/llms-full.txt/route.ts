import { LLMS_FULL_TXT, textHeaders } from "@/lib/llms";

export function GET() {
  return new Response(LLMS_FULL_TXT, { headers: textHeaders });
}
