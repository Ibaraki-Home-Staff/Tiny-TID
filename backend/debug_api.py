import httpx
import asyncio
import json

async def main():
    async with httpx.AsyncClient() as client:
        # Get master data
        r = await client.get('https://www.train-guide.westjr.co.jp/api/v3/area_kinki_master.json')
        data = r.json()

        lines = data.get('lines', {})
        print(f"Total lines: {len(lines)}")
        print(f"\nAvailable line IDs:")
        for i, line_id in enumerate(sorted(lines.keys())):
            line_data = lines[line_id]
            print(f"  {line_id}: {line_data.get('name', 'N/A')}")
            if i >= 20:
                print(f"  ... and {len(lines) - 21} more")
                break

        # Check kyoto line specifically
        kyoto = lines.get('kyoto', {})
        if kyoto:
            print(f"\nKyoto line data:")
            print(f"  Name: {kyoto.get('name')}")
            print(f"  All fields: {list(kyoto.keys())}")
            for k, v in kyoto.items():
                print(f"  {k}: {v}")

if __name__ == '__main__':
    asyncio.run(main())
