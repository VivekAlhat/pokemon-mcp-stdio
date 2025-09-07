import os
import json
import asyncio
import nest_asyncio
from groq import Groq
from typing import List
from dotenv import load_dotenv
from mcp.client.stdio import stdio_client
from mcp import ClientSession, StdioServerParameters

load_dotenv()
nest_asyncio.apply()


class PokeBot:
    def __init__(self):
        self.session: ClientSession = None
        self.llm = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        self.available_tools: List[dict] = []

    async def process_query(self, query):
        messages = [{"role": "user", "content": query}]
        print(f"\n[USER] {query}\n")

        # call the llm
        response = self.llm.chat.completions.create(
            model=os.environ.get("GROQ_LLM"),
            messages=messages,
            tools=self.available_tools,
        )

        response_message = response.choices[0].message
        tool_calls = response_message.tool_calls
        result_messages = []

        if tool_calls:
            print(f"[ASSISTANT] {response_message.content or '[Tool Calls detected]'}")
            messages.append(response_message)

            for tool_call in tool_calls:
                function_name = tool_call.function.name
                function_args = tool_call.function.arguments
                print(f"--> Calling tool `{function_name}` with args: {function_args}")

                # tool invocation through the client session
                result = await self.session.call_tool(
                    function_name, arguments=json.loads(function_args)
                )

                result_content = result.content
                if isinstance(result_content, list):
                    result_content = "\n".join(
                        str(item.text) for item in result_content
                    )

                print(f"<-- Result from `{function_name}`: {result_content}\n")

                # add the tool response to the conversation
                messages.append(
                    {
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": function_name,
                        "content": result_content,
                    }
                )

            # second API call with updated conversation
            response = self.llm.chat.completions.create(
                model=os.environ.get("GROQ_LLM"),
                messages=messages,
                tools=self.available_tools,
            )

            print(f"[ASSISTANT] {response.choices[0].message.content}\n")

            result_messages.append(
                {
                    "role": "assistant",
                    "content": response.choices[0].message.content,
                }
            )
            return result_messages

        # no tool calls
        print(f"[ASSISTANT] {response_message.content}\n")
        result_messages.append(
            {"role": "assistant", "content": response_message.content}
        )

        return result_messages

    async def chat_loop(self):
        print("\n")
        print("MCP PokeBot started!")
        print("Type your query or 'quit' to exit")

        while True:
            try:
                query = input("\nQuery: ").strip()
                if query.lower() == "quit":
                    break

                await self.process_query(query)
                print("\n")
            except Exception as e:
                print(f"\nError occurred: {str(e)}")

    async def connect_and_run_server(self):
        # create server params for stdio connection
        server_params = StdioServerParameters(
            command="uv", args=["run", "server/main.py"]
        )

        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                self.session = session

                # init the connection
                await session.initialize()

                # list available tools
                response = await session.list_tools()
                tools = response.tools
                print(
                    "\nConnected to MCP server with tools: ",
                    [tool.name for tool in tools],
                )

                self.available_tools = [
                    {
                        "type": "function",
                        "function": {
                            "name": tool.name,
                            "description": tool.description,
                            "parameters": tool.inputSchema,
                        },
                    }
                    for tool in response.tools
                ]

                # start chat loop
                await self.chat_loop()


async def main():
    pokebot = PokeBot()
    await pokebot.connect_and_run_server()


if __name__ == "__main__":
    asyncio.run(main())
