import urllib.request
import urllib.parse
import json
import sys
import os
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

def get_gumroad_token():
    token = os.getenv("GUMROAD_ACCESS_TOKEN") or os.getenv("GUMROAD_TOKEN")
    if token:
        return token.strip().strip('"').strip("'")
    for env_path in [Path(".env.local"), Path(r"C:\Users\risha\.env"), Path(r"C:\Users\risha\.gemini\antigravity\scratch\.env")]:
        if env_path.exists():
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.startswith("GUMROAD_TOKEN=") or line.startswith("GUMROAD_ACCESS_TOKEN="):
                            return line.split("=", 1)[1].strip().strip('"').strip("'")
            except Exception:
                pass
    return ""

TOKEN = get_gumroad_token()
BASE_URL = "https://api.gumroad.com/v2"

def get_headers():
    return {
        "User-Agent": "Assay-Manager/1.0",
        "Authorization": f"Bearer {TOKEN}"
    }

def fetch_products():
    url = f"{BASE_URL}/products"
    req = urllib.request.Request(url, headers=get_headers())
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            return data.get("products", [])
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.read().decode()}", file=sys.stderr)
        return []
    except Exception as e:
        print(f"Error fetching products: {e}", file=sys.stderr)
        return []

def get_user_profile():
    url = f"{BASE_URL}/user"
    req = urllib.request.Request(url, headers=get_headers())
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            return data.get("user", {})
    except Exception as e:
        print(f"Error fetching user profile: {e}", file=sys.stderr)
        return {}

def update_product_license(product_id):
    url = f"{BASE_URL}/products/{product_id}"
    for param_name in ["is_licensed", "generate_license", "license_key", "has_license_keys"]:
        data = urllib.parse.urlencode({param_name: "true"}).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=get_headers(), method="PUT")
        try:
            with urllib.request.urlopen(req) as resp:
                res = json.loads(resp.read().decode())
                print(f"Setting {param_name}=true: success={res.get('success')}")
                prod = res.get("product", {})
                found_license_keys = {k: v for k, v in prod.items() if "license" in k.lower()}
                print(f"  License fields in product: {found_license_keys}")
        except Exception as e:
            print(f"Error with {param_name}: {e}")


def delete_product(product_id):
    url = f"{BASE_URL}/products/{product_id}"
    req = urllib.request.Request(url, headers=get_headers(), method="DELETE")
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            return data.get("success", False)
    except urllib.error.HTTPError as e:
        print(f"Failed to delete {product_id}: HTTP {e.code} {e.read().decode()}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Error deleting {product_id}: {e}", file=sys.stderr)
        return False

def archive_product(product_id):
    # In Gumroad API, updating a product with published=False or unpublishing / deleting it
    url = f"{BASE_URL}/products/{product_id}"
    data = urllib.parse.urlencode({"published": "false"}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=get_headers(), method="PUT")
    try:
        with urllib.request.urlopen(req) as resp:
            res_data = json.loads(resp.read().decode())
            return res_data.get("success", False)
    except Exception as e:
        print(f"Error unpublishing {product_id}: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "list"

    if action == "profile":
        user = get_user_profile()
        print(json.dumps(user, indent=2))

    elif action == "list":
        products = fetch_products()
        print(f"Found {len(products)} products:")
        for idx, p in enumerate(products, 1):
            print(f"{idx}. ID: {p.get('id')}")
            print(f"   Name: {p.get('name')}")
            print(f"   Permalink: {p.get('custom_permalink') or p.get('short_url')}")
            print(f"   Price: ${p.get('price', 0) / 100:.2f}")
            print(f"   Published: {p.get('published')}")
            print(f"   URL: {p.get('url')}")
            print()

    elif action == "license":
        products = fetch_products()
        if not products:
            print("No products found.")
        else:
            pid = products[0].get("id")
            print(f"Updating product {pid}...")
            update_product_license(pid)

