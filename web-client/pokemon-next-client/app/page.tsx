"use client";

import { useState } from "react";
import { useMcp } from "use-mcp/react";
import { Send, Settings, X, Zap } from "lucide-react";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessage {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  name?: string;
}

interface GroqResponse {
  success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  message?: any;
  error?: string;
}

export default function ChatWithPokemon() {
  const { state, tools, callTool, error, retry } = useMcp({
    url: process.env.NEXT_PUBLIC_MCP_SERVER!,
    clientName: "nextjs-pokemon-bot",
    transportType: "http",
    autoReconnect: true,
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTools, setShowTools] = useState(false);

  const callGroqAPI = async (
    messages: ChatMessage[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: any[]
  ): Promise<GroqResponse> => {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
          ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
          ...(msg.name && { name: msg.name }),
        })),
        tools,
        model: process.env.NEXT_PUBLIC_GROQ_LLM || "openai/gpt-oss-20b",
      }),
    });

    return response.json();
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      // Step 1: Initial call to Groq via API route
      const response = await callGroqAPI(newMessages, tools);

      if (!response.success) {
        throw new Error(response.error || "API call failed");
      }

      const assistantMessage = response.message;

      // Check if the assistant wants to call tools
      if (
        assistantMessage.tool_calls &&
        assistantMessage.tool_calls.length > 0
      ) {
        // Add assistant message with tool calls
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: assistantMessage.content || "",
          tool_calls: assistantMessage.tool_calls,
        };

        const updatedMessages = [...newMessages, assistantMsg];

        // Execute each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          try {
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(
              toolCall.function.arguments || "{}"
            );

            // Call the MCP tool
            const toolResult = await callTool(functionName, functionArgs);

            // Add tool response message
            const toolMessage: ChatMessage = {
              role: "tool",
              content: JSON.stringify(toolResult),
              tool_call_id: toolCall.id,
              name: functionName,
            };

            updatedMessages.push(toolMessage);
          } catch (toolError) {
            console.error(
              `Error calling tool ${toolCall.function.name}:`,
              toolError
            );

            // Add error message as tool response
            const errorMessage: ChatMessage = {
              role: "tool",
              content: JSON.stringify({
                error: `Failed to execute ${toolCall.function.name}`,
              }),
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
            };

            updatedMessages.push(errorMessage);
          }
        }

        // Step 2: Call Groq again with tool results
        const followupResponse = await callGroqAPI(updatedMessages, tools);

        if (!followupResponse.success) {
          throw new Error(
            followupResponse.error || "Follow-up API call failed"
          );
        }

        const finalMessage: ChatMessage = {
          role: "assistant",
          content: followupResponse.message.content || "",
        };

        setMessages([...updatedMessages, finalMessage]);
      } else {
        // No tool calls needed, just add the assistant's response
        const finalMessage: ChatMessage = {
          role: "assistant",
          content: assistantMessage.content || "",
        };

        setMessages([...newMessages, finalMessage]);
      }
    } catch (err) {
      console.error("Chat error:", err);

      // Add error message to chat
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: `Sorry, I encountered an error: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      };

      setMessages([...newMessages, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (state === "failed") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Connection Failed
          </h3>
          <p className="text-gray-600 mb-6">
            Unable to connect to MCP server: {String(error)}
          </p>
          <button
            onClick={retry}
            className="w-full bg-red-600 text-white rounded-xl px-4 py-2 hover:bg-red-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (state !== "ready") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Connecting
          </h3>
          <p className="text-gray-600">
            Establishing connection to MCP server...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">🔍</span>
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    Pokémon Chat
                  </h1>
                  <p className="text-sm text-gray-500">
                    Powered by MCP Tools & Groq AI
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {tools.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1 text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      <Zap className="w-3 h-3" />
                      <span>{tools.length} tools</span>
                    </div>
                    <button
                      onClick={() => setShowTools(!showTools)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="View available tools"
                    >
                      <Settings className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {showTools && (
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">
                Available Tools
              </h3>
              <button
                onClick={() => setShowTools(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {tools.map((tool, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                >
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {tool.name}
                      </h4>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {tool.description || "No description available"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col h-[calc(100vh-80px)]">
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-2xl">🎯</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Ready to explore Pokémon!
                </h3>
                <p className="text-gray-500">
                  Ask me anything about Pokémon and I&apos;ll use my tools to
                  help you.
                </p>
              </div>
            )}

            <div className="space-y-6">
              {messages.map((message, index) => (
                <div key={index} className="flex items-start space-x-3">
                  {message.role === "user" ? (
                    <>
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          U
                        </span>
                      </div>
                      <div className="flex-1 bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-200">
                        <p className="text-gray-900">{message.content}</p>
                      </div>
                    </>
                  ) : message.role === "tool" ? (
                    <>
                      <div className="flex-shrink-0 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                        <Zap className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 bg-orange-50 rounded-2xl rounded-tl-sm px-4 py-3 border border-orange-200">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-xs font-medium text-orange-800 uppercase tracking-wide">
                            Tool: {message.name}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-orange-700 bg-white rounded-lg p-2 overflow-x-auto">
                          {message.content}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">🤖</span>
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="text-gray-900 whitespace-pre-wrap">
                          <Markdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </Markdown>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">🤖</span>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                      <span className="text-gray-600">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border-t border-gray-200 px-6 py-4">
            <div className="flex items-end space-x-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about Pokémon..."
                  disabled={loading}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50 text-black"
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="flex-shrink-0 bg-blue-600 text-white rounded-2xl p-3 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 px-1">
              Press Enter to send • Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
