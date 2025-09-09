import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const {
      messages,
      tools,
      model = "openai/gpt-oss-20b",
    } = await request.json();

    // Prepare tools for Groq API format
    const groqTools =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools?.map((tool: any) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      })) || [];

    const response = await groq.chat.completions.create({
      model,
      messages,
      tools: groqTools.length > 0 ? groqTools : undefined,
      tool_choice: groqTools.length > 0 ? "auto" : undefined,
    });

    return NextResponse.json({
      success: true,
      message: response.choices[0].message,
    });
  } catch (error) {
    console.error("Groq API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
