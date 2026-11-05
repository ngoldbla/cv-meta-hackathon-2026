import { LLMS_TXT, textHeaders } from "@/lib/llms";

export function GET() {
  return new Response(LLMS_TXT, { headers: textHeaders });
}
