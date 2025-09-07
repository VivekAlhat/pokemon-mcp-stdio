# Pokemon MCP

This project is an experiment to try out a stdio-based MCP client and server, using the PokéAPI as an example tool. It demonstrates how an LLM can interact with external APIs via MCP tools.

## Features

- **MCP stdio client/server**: Communicate between a Python client and server using MCP over stdio.
- **PokéAPI integration**: Query Pokémon abilities and stats using [PokéAPI](https://pokeapi.co/).
- **LLM tool-calling**: Use Groq's LLM to call server-side tools for Pokémon data.

## Project Structure

```
.
├── .env
├── .gitignore
├── .python-version
├── main.py
├── pyproject.toml
├── README.md
├── uv.lock
├── client/
│   └── main.py
└── server/
    └── main.py
```

- `client/main.py`: MCP stdio client that connects to the server, uses Groq LLM, and interacts with the user.
- `server/main.py`: MCP server exposing tools for fetching Pokémon abilities and stats.

## Setup

### Prerequisites

- Python 3.12+
- [uv](https://github.com/astral-sh/uv)
- [Groq API key](https://console.groq.com/keys) (for LLM access)

### Installation

1. **Clone the repository:**

   ```sh
   git clone https://github.com/VivekAlhat/pokemon-mcp-stdio
   cd pokemon-mcp-stdio
   ```

2. **Create and activate a virtual environment:**

   ```sh
   uv init
   uv venv
   source .venv/bin/activate
   ```

3. **Install dependencies:**

   ```sh
   uv sync
   ```

4. **Set up environment variables:**

   Create `.env` and fill in your Groq API key:

   ```
   GROQ_API_KEY=your_groq_api_key
   GROQ_LLM=openai/gpt-oss-20b
   ```

## Usage

1. **Start the client:**

   ```sh
   uv run client/main.py
   ```

   The client will automatically launch the server via stdio.

2. **Interact with the bot:**

   - Type your Pokémon-related queries (e.g., "What are Pikachu's abilities?" or "Show me Bulbasaur's stats").
   - Type `quit` to exit.

## How it Works

- The client uses Groq's LLM to interpret user queries.
- If the LLM determines a tool call is needed, it invokes the appropriate tool on the MCP server.
- The server fetches data from PokéAPI and returns results to the client, which are then shown to the user.

## Development

- Add new tools to `server/main.py` using the `@mcp.tool()` decorator.
- The client will automatically detect and expose new tools.
