# Pokemon MCP

This project is an experiment to try out a stdio-based MCP (Model Context Protocol) client and server, using the PokéAPI as an example tool. It demonstrates how an LLM (Groq) can interact with external APIs via MCP tools, enabling tool-calling and data retrieval in a conversational interface.

## Features

- **MCP stdio client/server**: Python-based client and server communicate using MCP over stdio.
- **PokéAPI integration**: Fetch Pokémon abilities and stats from [PokéAPI](https://pokeapi.co/).
- **LLM tool-calling**: Uses Groq's LLM to interpret user queries and call server-side tools as needed.
- **Extensible tools**: Easily add new API integrations as MCP tools.
- **Web client**: Modern Next.js-based web UI for interacting with the MCP server.

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
├── server/
│   └── main.py
└── web-client/
    ├── README.md
    ├── pokemon-mcp-server/
    │   └── main.py
    └── pokemon-next-client/
        ├── app/
        ├── public/
        ├── ...
```

- `client/main.py`: MCP stdio CLI based client that interacts with the user and the LLM, and communicates with the server.
- `server/main.py`: MCP server exposing tools for fetching Pokémon data from PokéAPI.
- `web-client/pokemon-mcp-server/main.py`: Python server for web integration (see web-client README for details).
- `web-client/pokemon-next-client/`: Next.js 14+ web client for a modern chat UI.

## Setup

### Prerequisites

- Python 3.12+
- [uv](https://github.com/astral-sh/uv) (recommended for dependency management)
- [Groq API key](https://console.groq.com/keys) (for LLM access)
- [Node.js](https://nodejs.org/) 18+ and [pnpm](https://pnpm.io/) (for web client)

### Installation (Python CLI/Server)

1. **Clone the repository:**

   ```sh
   git clone https://github.com/VivekAlhat/pokemon-mcp-stdio
   cd pokemon-mcp-stdio
   ```

2. **Create and activate a virtual environment:**

   ```sh
   uv venv
   source .venv/bin/activate
   ```

3. **Install dependencies:**

   ```sh
   uv sync
   ```

4. **Set up environment variables:**

   Create a `.env` file and add your Groq API key:

   ```
   GROQ_API_KEY=your_groq_api_key
   GROQ_LLM=openai/gpt-oss-20b
   ```

### Installation (Web Client)

1. **Go to the web client directory:**

   ```sh
   cd web-client/pokemon-next-client
   ```

2. **Install dependencies:**

   ```sh
   pnpm install
   ```

3. **Set up environment variables:**

   - Copy `.env.example` to `.env` and fill in the required values (see the file for details).

4. **Run the Next.js development server:**

   ```sh
   pnpm dev
   ```

   The app will be available at [http://localhost:3000](http://localhost:3000).

5. **Start the Python MCP server for web:**
   ```sh
   cd ../pokemon-mcp-server
   uvicorn main:app --host 127.0.0.1 --port 8000
   ```
   (See `web-client/README.md` for more details.)

## Usage

### CLI

1. **Start the client:**

   ```sh
   uv run client/main.py
   ```

   The client will automatically launch the server via stdio.

2. **Interact with the bot:**
   - Ask Pokémon-related questions (e.g., "What are Pikachu's abilities?" or "Show me Bulbasaur's stats").
   - Type `quit` to exit.

### Web

1. **Start the Next.js client and the Python MCP server for web as described above.**
2. **Open [http://localhost:3000](http://localhost:3000) in your browser.**
3. **Chat with the bot using the web interface.**

## How it Works

- The client (CLI or web) takes user input and uses Groq's LLM to interpret the query.
- If a tool call is needed, the LLM instructs the client to invoke the appropriate tool on the MCP server.
- The server fetches data from PokéAPI and returns results to the client, which are then shown to the user.

## Extending

- Add new tools to `server/main.py` or `web-client/pokemon-mcp-server/main.py` using the `@mcp.tool()` decorator.
- The client(s) will automatically detect and expose new tools for LLM use.
