"""
Tiny-TID 初期設定ウィザード
.envファイルが存在しない場合に対話式で設定を行う
"""

import json
import os
from typing import Dict, List, Optional
import requests


# JIS X 0401 都道府県コード
PREFECTURES = {
    "01": "北海道",
    "02": "青森県",
    "03": "岩手県",
    "04": "宮城県",
    "05": "秋田県",
    "06": "山形県",
    "07": "福島県",
    "08": "茨城県",
    "09": "栃木県",
    "10": "群馬県",
    "11": "埼玉県",
    "12": "千葉県",
    "13": "東京都",
    "14": "神奈川県",
    "15": "新潟県",
    "16": "富山県",
    "17": "石川県",
    "18": "福井県",
    "19": "山梨県",
    "20": "長野県",
    "21": "岐阜県",
    "22": "静岡県",
    "23": "愛知県",
    "24": "三重県",
    "25": "滋賀県",
    "26": "京都府",
    "27": "大阪府",
    "28": "兵庫県",
    "29": "奈良県",
    "30": "和歌山県",
    "31": "鳥取県",
    "32": "島根県",
    "33": "岡山県",
    "34": "広島県",
    "35": "山口県",
    "36": "徳島県",
    "37": "香川県",
    "38": "愛媛県",
    "39": "高知県",
    "40": "福岡県",
    "41": "佐賀県",
    "42": "長崎県",
    "43": "熊本県",
    "44": "大分県",
    "45": "宮崎県",
    "46": "鹿児島県",
    "47": "沖縄県",
}

# JR西日本エリア表示名→APIキーマッピング
JR_AREAS = {
    "北陸": "hokuriku",
    "近畿": "kinki",
    "岡山": "okayama",
    "広島": "hiroshima",
    "山陰": "sanin",
}

# JR西日本APIベースURL
JR_BASE_URL = "https://www.train-guide.westjr.co.jp/api/v3"


def print_header(text: str):
    """ヘッダー表示"""
    print(f"\n{'=' * 60}")
    print(f"  {text}")
    print(f"{'=' * 60}")


def print_step(step: int, total: int, text: str):
    """ステップ表示"""
    print(f"\n[{step}/{total}] {text}")
    print("-" * 40)


def select_prefecture() -> str:
    """都道府県を選択"""
    print("都道府県を選択してください（JIS X 0401コード）:\n")

    # 8つずつ表示
    prefecture_items = list(PREFECTURES.items())
    for i in range(0, len(prefecture_items), 4):
        row = prefecture_items[i : i + 4]
        line = "  ".join([f"{code}: {name}" for code, name in row])
        print(f"  {line}")

    while True:
        code = input("\n都道府県コードを入力してください（例: 13）: ").strip()
        if code in PREFECTURES:
            print(f"選択: {PREFECTURES[code]}")
            return code
        print("無効なコードです。もう一度入力してください。")


def input_api_key() -> str:
    """駅すぱあとAPIキー入力"""
    print("\n駅すぱあとAPIキーを入力してください:")
    print("（https://roote.ekispert.net/ で取得できます）")

    while True:
        key = input("APIキー: ").strip()
        if key:
            return key
        print("APIキーは必須です。")


def search_stations(
    api_key: str, prefecture_code: str, station_name: str
) -> List[Dict]:
    """駅すぱあとAPIで駅を検索"""
    url = f"https://api.ekispert.jp/v1/json/station/light"
    params = {
        "key": api_key,
        "name": station_name,
        "type": "train",
        "prefectureCode": prefecture_code,
    }

    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()

        if "ResultSet" in data and "Point" in data["ResultSet"]:
            points = data["ResultSet"]["Point"]
            if isinstance(points, list):
                return points
            else:
                return [points]
        return []
    except Exception as e:
        print(f"駅検索エラー: {e}")
        return []


def select_station(api_key: str, prefecture_code: str) -> str:
    """駅を選択して駅コードを返す"""
    print(f"\n{PREFECTURES[prefecture_code]}の駅を検索します。")

    while True:
        station_name = input("駅名を入力してください（部分一致検索）: ").strip()
        if not station_name:
            continue

        print(f"'{station_name}' を検索中...")
        stations = search_stations(api_key, prefecture_code, station_name)

        if not stations:
            print("駅が見つかりませんでした。別のキーワードを試してください。")
            continue

        print(f"\n{len(stations)}件の駅が見つかりました:\n")
        for i, point in enumerate(stations, 1):
            station = point["Station"]
            name = station["Name"]
            code = station["code"]
            yomi = station.get("Yomi", "")
            print(f"  {i}. {name} ({yomi}) - コード: {code}")

        while True:
            try:
                choice = input("\n選択する駅の番号を入力してください: ").strip()
                idx = int(choice) - 1
                if 0 <= idx < len(stations):
                    selected = stations[idx]["Station"]
                    print(f"選択: {selected['Name']} (コード: {selected['code']})")
                    return selected["code"]
                print("無効な番号です。")
            except ValueError:
                print("数字を入力してください。")


def select_jr_area() -> str:
    """JR西日本エリアを選択"""
    print("\nJR西日本のエリアを選択してください:\n")

    area_list = list(JR_AREAS.items())
    for i, (display, key) in enumerate(area_list, 1):
        print(f"  {i}. {display}")

    while True:
        try:
            choice = input("\n選択するエリアの番号を入力してください: ").strip()
            idx = int(choice) - 1
            if 0 <= idx < len(area_list):
                display_name, area_key = area_list[idx]
                print(f"選択: {display_name}")
                return area_key
            print("無効な番号です。")
        except ValueError:
            print("数字を入力してください。")


def fetch_jr_lines(area: str) -> Dict[str, Dict[str, str]]:
    """JR西日本エリアの路線一覧を取得（nameとrangeを含む）"""
    url = f"{JR_BASE_URL}/area_{area}_master.json"

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()

        lines = {}
        if "lines" in data:
            # data["lines"]は辞書形式 {line_id: {name: ..., range: ...}}
            for line_id, line_data in data["lines"].items():
                if isinstance(line_data, dict):
                    line_name = line_data.get("name", line_id)
                    line_range = line_data.get("range", "")
                    lines[line_id] = {"name": line_name, "range": line_range}
        return lines
    except Exception as e:
        print(f"路線一覧取得エラー: {e}")
        return {}


def select_jr_lines(area: str) -> List[str]:
    """JR西日本の路線を複数選択"""
    print(f"\n{area}エリアの路線を取得中...")
    lines = fetch_jr_lines(area)

    if not lines:
        print("路線情報が取得できませんでした。")
        return []

    print(f"\n{len(lines)}路線が見つかりました:\n")
    line_items = list(lines.items())
    for i, (line_id, line_info) in enumerate(line_items, 1):
        line_name = line_info.get("name", line_id)
        line_range = line_info.get("range", "")
        if line_range:
            print(f"  {i}. {line_name}（{line_range}） ({line_id})")
        else:
            print(f"  {i}. {line_name} ({line_id})")

    print("\n複数選択する場合は、カンマ区切りで番号を入力してください（例: 1,3,5）")
    print("全て選択する場合は 'all' と入力してください")

    while True:
        choice = input("\n選択する路線の番号を入力してください: ").strip()

        if choice.lower() == "all":
            selected = [line_id for line_id, _ in line_items]
            print(f"選択: 全{len(selected)}路線")
            return selected

        try:
            indices = [int(x.strip()) - 1 for x in choice.split(",")]
            selected = []
            for idx in indices:
                if 0 <= idx < len(line_items):
                    selected.append(line_items[idx][0])

            if selected:
                print(f"選択: {len(selected)}路線")
                for line_id in selected:
                    line_info = lines[line_id]
                    line_name = line_info.get("name", line_id)
                    line_range = line_info.get("range", "")
                    if line_range:
                        print(f"  - {line_name}（{line_range}）")
                    else:
                        print(f"  - {line_name}")
                return selected
            print("有効な路線が選択されていません。")
        except ValueError:
            print("無効な入力です。数字または'all'を入力してください。")


def fetch_jr_stations(line_id: str) -> Dict[str, str]:
    """路線の駅一覧を取得"""
    url = f"{JR_BASE_URL}/{line_id}_st.json"

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()

        stations = {}
        if "stations" in data:
            for station_data in data["stations"]:
                # station_dataは{"info": {...}, "design": {...}}の形式
                info = station_data.get("info", {})
                code = info.get("code", "")
                name = info.get("name", "")
                if code and name:
                    stations[code] = name
        return stations
    except Exception as e:
        print(f"駅一覧取得エラー ({line_id}): {e}")
        return {}


def select_jr_station(line_ids: List[str], area: str) -> tuple:
    """JR西日本の駅を選択（エア・路線を指定して正確に選ぶ）"""
    print(f"\n{len(line_ids)}路線から駅を検索します。")
    print(f"対象エア: {area}")

    # 各路線の駅を個別に収集（路線情報も保持）
    line_stations = {}  # {line_id: {code: name}}
    for line_id in line_ids:
        stations = fetch_jr_stations(line_id)
        if stations:
            line_stations[line_id] = stations

    if not line_stations:
        print("駅情報が取得できませんでした。")
        return "", ""

    total_stations = sum(len(stations) for stations in line_stations.values())
    print(f"\n{total_stations}駅のデータが取得できました")
    print("（駅名で検索すると、選択した路線上の駅のみ表示されます）")

    while True:
        search_name = input("\n駅名（または部分一致キーワード）: ").strip()
        if not search_name:
            continue

        # 各路線から検索
        matched_by_line = {}  # {line_id: [(code, name), ...]}
        for line_id, stations in line_stations.items():
            matched = [
                (code, name) for code, name in stations.items() if search_name in name
            ]
            if matched:
                matched_by_line[line_id] = matched

        if not matched_by_line:
            print("該当する駅が見つかりませんでした。別のキーワードを試してください。")
            continue

        # 結果を表示（路線ごと）
        all_matched = []
        print(
            f"\n{sum(len(m) for m in matched_by_line.values())}件の駅が見つかりました:\n"
        )

        for line_id, matched in matched_by_line.items():
            print(f"  [{line_id}] {len(matched)}駅:")
            for code, name in matched:
                all_matched.append((line_id, code, name))
                print(f"    - {name} (コード: {code})")
            print()

        # 選択
        if len(all_matched) == 1:
            # 1件のみの場合は自動選択
            line_id, code, name = all_matched[0]
            print(f"選択: {name} (コード: {code}) - {line_id}線上")
            return code, line_id

        print(f"選択する駅を指定してください（形式: 路線ID,駅コード）")
        print(f"例: {all_matched[0][0]},{all_matched[0][1]}")

        while True:
            choice = input("\n選択: ").strip()
            parts = choice.split(",")
            if len(parts) == 2:
                selected_line, selected_code = parts[0].strip(), parts[1].strip()
                # 選択が有効か確認
                found = None
                for line_id, code, name in all_matched:
                    if line_id == selected_line and code == selected_code:
                        found = (line_id, code, name)
                        break
                if found:
                    line_id, code, name = found
                    print(f"選択: {name} (コード: {code}) - {line_id}線上")
                    return code, line_id
            print("無効な選択です。正しい形式で入力してください。")


def input_rate_settings() -> tuple:
    """レート設定を入力"""
    print("\nデータ取得間隔を設定してください（秒単位）:")

    # デフォルト値
    default_polling = 10
    default_line = 2.0

    polling_input = input(f"全路線更新間隔 [{default_polling}]: ").strip()
    polling = int(polling_input) if polling_input.isdigit() else default_polling

    line_input = input(f"各路線間の待機間隔 [{default_line}]: ").strip()
    line_interval = float(line_input) if line_input else default_line

    print(f"\n設定値:")
    print(f"  全路線更新間隔: {polling}秒")
    print(f"  各路線待機間隔: {line_interval}秒")

    return polling, line_interval


def input_cache_dir() -> str:
    """キャッシュディレクトリを入力"""
    default_dir = "./cache"
    dir_input = input(f"\nキャッシュディレクトリ [{default_dir}]: ").strip()
    cache_dir = dir_input if dir_input else default_dir
    print(f"設定: {cache_dir}")
    return cache_dir


def generate_env_file(config: Dict) -> bool:
    """.envファイルを生成"""
    env_content = f"""# 駅すぱあとAPI設定
EKISPERT_API_KEY={config["ekispert_api_key"]}
STATION_CODE={config["station_code"]}

# キャッシュ設定
CACHE_DIR={config["cache_dir"]}

# JR西日本リアルタイム設定
WJRC_AREA={config["wjrc_area"]}
WJRC_LINE={config["wjrc_line"]}
WJRC_STCODE={config["wjrc_stcode"]}
WJRC_POLLING_INTERVAL={config["wjrc_polling_interval"]}
WJRC_LINE_INTERVAL={config["wjrc_line_interval"]}
"""

    try:
        with open(".env", "w", encoding="utf-8") as f:
            f.write(env_content)
        return True
    except Exception as e:
        print(f".envファイル生成エラー: {e}")
        return False


def run_wizard() -> bool:
    """
    ウィザードを実行して.envファイルを生成
    成功したらTrueを返す
    """
    print_header("Tiny-TID 初期設定ウィザード")
    print("\n.envファイルが見つかりませんでした。")
    print("初期設定を対話式で行います。\n")

    total_steps = 8
    current_step = 0

    # ステップ1: 都道府県選択
    current_step += 1
    print_step(current_step, total_steps, "都道府県の選択")
    prefecture_code = select_prefecture()

    # ステップ2: APIキー入力
    current_step += 1
    print_step(current_step, total_steps, "駅すぱあとAPIキーの入力")
    api_key = input_api_key()

    # ステップ3: 駅選択（駅すぱあと）
    current_step += 1
    print_step(current_step, total_steps, "駅の検索と選択（駅すぱあと）")
    station_code = select_station(api_key, prefecture_code)

    # ステップ4: JR西日本エリア選択
    current_step += 1
    print_step(current_step, total_steps, "JR西日本エリアの選択")
    jr_area = select_jr_area()

    # ステップ5: JR西日本路線選択
    current_step += 1
    print_step(current_step, total_steps, "JR西日本路線の選択")
    jr_lines = select_jr_lines(jr_area)
    jr_line_str = ",".join(jr_lines) if jr_lines else ""

    # ステップ6: JR西日本駅選択
    current_step += 1
    print_step(current_step, total_steps, "JR西日本駅の選択")
    jr_station_code = ""
    jr_station_line = ""
    if jr_lines:
        jr_station_code, jr_station_line = select_jr_station(jr_lines, jr_area)

        # 選択された駅が路線上にない場合は警告
        if jr_station_code and not jr_station_line:
            print("\n警告: 選択された駅が指定路線上に見つかりません。")
            confirm = input("このまま続行しますか？ (y/n): ").strip().lower()
            if confirm != "y":
                print("キャンセルしました。")
                return False

    # ステップ7: レート設定
    current_step += 1
    print_step(current_step, total_steps, "データ取得間隔の設定")
    polling_interval, line_interval = input_rate_settings()

    # ステップ8: キャッシュディレクトリ
    current_step += 1
    print_step(current_step, total_steps, "キャッシュディレクトリの設定")
    cache_dir = input_cache_dir()

    # 設定をまとめる
    config = {
        "ekispert_api_key": api_key,
        "station_code": station_code,
        "cache_dir": cache_dir,
        "wjrc_area": jr_area,
        "wjrc_line": jr_line_str,
        "wjrc_stcode": jr_station_code,
        "wjrc_polling_interval": polling_interval,
        "wjrc_line_interval": line_interval,
    }

    # 確認表示
    print_header("設定内容の確認")
    print(f"駅すぱあとAPIキー: {'*' * 8}{api_key[-4:] if len(api_key) > 4 else ''}")
    print(f"駅コード: {station_code}")
    print(f"JR西日本エリア: {jr_area}")
    print(f"JR西日本路線: {jr_line_str[:50]}{'...' if len(jr_line_str) > 50 else ''}")
    print(f"JR西日本駅コード: {jr_station_code}")
    print(f"ポーリング間隔: {polling_interval}秒")
    print(f"路線間隔: {line_interval}秒")
    print(f"キャッシュディレクトリ: {cache_dir}")

    confirm = input("\nこの設定で.envファイルを生成しますか？ (y/n): ").strip().lower()
    if confirm != "y":
        print("キャンセルしました。")
        return False

    # .envファイル生成
    if generate_env_file(config):
        print_header("設定完了")
        print(".envファイルが生成されました。")
        print("アプリケーションを起動します...\n")
        return True
    else:
        print("エラー: .envファイルの生成に失敗しました。")
        return False


def check_env_exists() -> bool:
    """.envファイルが存在するかチェック"""
    return os.path.exists(".env")


if __name__ == "__main__":
    if not check_env_exists():
        run_wizard()
    else:
        print(".envファイルは既に存在します。")
