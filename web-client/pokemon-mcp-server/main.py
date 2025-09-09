import time
import uvicorn
import requests
import argparse
from typing import Dict
from fastapi import FastAPI
from mcp.server.fastmcp import FastMCP
from fastapi.middleware.cors import CORSMiddleware


mcp = FastMCP("pokemon-mcp", stateless_http=True)


@mcp.tool()
def get_pokemon_abilities(
    pokemon_name: str,
) -> Dict:
    """
    Fetch abilities for a specific Pokémon from the PokéAPI.

    Args:
        pokemon_name (str): The Pokémon name (str).
    """
    base_url = "https://pokeapi.co/api/v2"

    if not pokemon_name:
        raise ValueError("Pokemon identifier cannot be empty")

    if isinstance(pokemon_name, str):
        pokemon_name = pokemon_name.lower().strip()
    elif isinstance(pokemon_name, int):
        if pokemon_name <= 0:
            raise ValueError("Pokemon ID must be a positive integer")
    else:
        raise ValueError("Pokemon identifier must be a string or positive integer")

    try:
        pokemon_url = f"{base_url}/pokemon/{pokemon_name}"
        response = requests.get(pokemon_url, timeout=10)

        if response.status_code == 404:
            raise ValueError(f"Pokémon '{pokemon_name}' not found")

        response.raise_for_status()
        pokemon_data = response.json()

        # extract basic information
        result = {
            "pokemon_name": pokemon_data["name"],
            "pokemon_id": pokemon_data["id"],
            "abilities": [],
        }

        # process abilities
        for ability_entry in pokemon_data["abilities"]:
            ability_info = {
                "name": ability_entry["ability"]["name"],
                "is_hidden": ability_entry["is_hidden"],
                "slot": ability_entry["slot"],
            }

            # fetch detailed information
            try:
                ability_url = ability_entry["ability"]["url"]
                ability_response = requests.get(ability_url, timeout=10)
                ability_response.raise_for_status()
                ability_detail = ability_response.json()

                # get English description and effect
                description = "No description available"
                effect = "No effect description available"

                # find English flavor text (description)
                for flavor_text in ability_detail.get("flavor_text_entries", []):
                    if flavor_text["language"]["name"] == "en":
                        description = (
                            flavor_text["flavor_text"]
                            .replace("\n", " ")
                            .replace("\f", " ")
                        )
                        break

                # find English effect entry
                for effect_entry in ability_detail.get("effect_entries", []):
                    if effect_entry["language"]["name"] == "en":
                        effect = effect_entry["effect"]
                        break

                ability_info.update(
                    {
                        "description": description,
                        "effect": effect,
                        "generation": ability_detail["generation"]["name"],
                    }
                )

                time.sleep(0.1)

            except requests.exceptions.RequestException as e:
                print(
                    f"Warning: Could not fetch detailed info for ability '{ability_info['name']}': {e}"
                )

            result["abilities"].append(ability_info)

        # sort abilities by slot for consistent ordering
        result["abilities"].sort(key=lambda x: x["slot"])

        return result

    except requests.exceptions.Timeout:
        raise requests.exceptions.RequestException(
            "Request timed out. Please try again."
        )
    except requests.exceptions.ConnectionError:
        raise requests.exceptions.RequestException(
            "Connection error. Please check your internet connection."
        )
    except requests.exceptions.RequestException as e:
        raise requests.exceptions.RequestException(f"API request failed: {e}")
    except KeyError as e:
        raise Exception(f"Unexpected API response structure. Missing key: {e}")
    except Exception as e:
        raise Exception(f"An unexpected error occurred: {e}")


@mcp.tool()
def get_pokemon_stats(pokemon_name: str) -> Dict:
    """
    Fetch base stats for a specific Pokémon by name from the PokéAPI.

    Args:
        pokemon_name (str): The name of the Pokémon.
    """

    if not isinstance(pokemon_name, str):
        raise ValueError("Pokemon name must be a string")

    if not pokemon_name or not pokemon_name.strip():
        raise ValueError("Pokemon name cannot be empty")

    clean_name = pokemon_name.lower().strip()

    base_url = "https://pokeapi.co/api/v2"
    pokemon_url = f"{base_url}/pokemon/{clean_name}"

    try:
        response = requests.get(pokemon_url, timeout=10)

        if response.status_code == 404:
            raise ValueError(
                f"Pokémon '{pokemon_name}' not found. Please check the spelling and try again."
            )

        # raise exception for other HTTP errors
        response.raise_for_status()

        pokemon_data = response.json()

        # extract stats information
        base_stats = {}
        stat_details = []
        total_stats = 0

        for stat_entry in pokemon_data["stats"]:
            stat_name = stat_entry["stat"]["name"]
            base_stat_value = stat_entry["base_stat"]
            effort_value = stat_entry["effort"]

            # add to base_stats dictionary
            base_stats[stat_name] = base_stat_value

            # add to detailed stats list
            stat_details.append(
                {
                    "stat_name": stat_name,
                    "base_stat": base_stat_value,
                    "effort": effort_value,
                }
            )

            # calculate total
            total_stats += base_stat_value

        # construct result dictionary
        result = {
            "pokemon_name": pokemon_data["name"],
            "pokemon_id": pokemon_data["id"],
            "base_stats": base_stats,
            "total_base_stats": total_stats,
            "stat_details": stat_details,
        }

        return result

    except requests.exceptions.Timeout:
        raise requests.exceptions.RequestException(
            "Request timed out while fetching Pokémon data. Please try again."
        )
    except requests.exceptions.ConnectionError:
        raise requests.exceptions.RequestException(
            "Unable to connect to PokéAPI. Please check your internet connection."
        )
    except requests.exceptions.RequestException as e:
        raise requests.exceptions.RequestException(
            f"Failed to fetch Pokémon data: {str(e)}"
        )
    except KeyError as e:
        raise Exception(f"Unexpected API response format. Missing expected field: {e}")
    except Exception as e:
        raise Exception(
            f"An unexpected error occurred while processing Pokémon stats: {str(e)}"
        )


app = FastAPI(title="pokemon-fastapi", lifespan=lambda app: mcp.session_manager.run())
app.mount("/server", mcp.streamable_http_app())

# Apply CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run MCP server with FastAPI")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host IP address")
    parser.add_argument("--port", type=int, default=8000, help="Port number")
    args = parser.parse_args()

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
