/* tslint:disable */
/* eslint-disable */

export function build_full_snapshot(built_at: string, st_docs_json: string, masters_json: string): string;

export function build_view_json(snapshot_json: string, req_json: string): string;

export function cron_evaluate_json(snapshot_json: string, req_json: string): string;

export function parse_color_map_json(text: string): string;

export function snapshot_version(): number;
