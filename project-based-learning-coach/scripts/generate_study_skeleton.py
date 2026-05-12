#!/usr/bin/env python3
"""Generate a chapter-based learning skeleton from project summary.

This script intentionally outputs structure only (no concrete knowledge points).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from dataclasses import dataclass, asdict


@dataclass
class Chapter:
    title: str
    goal: str
    relation: str
    sections: list[dict]
    checkpoint: dict
    status: str
    approval_required: bool


def build_chapter(index: int, total: int) -> Chapter:
    prev_label = f"第{index - 1}章" if index > 1 else "无"
    next_label = f"第{index + 1}章" if index < total else "无"
    return Chapter(
        title=f"第{index}章",
        goal="定义本章目标与产出边界",
        relation=f"前置：{prev_label}；后续：{next_label}",
        sections=[
            {"name": "分节A", "goal": "明确子目标", "output": "结构化笔记"},
            {"name": "分节B", "goal": "执行学习动作", "output": "阶段产出"},
            {"name": "分节C", "goal": "整合与校验", "output": "本节结论"},
        ],
        checkpoint={
            "process": "是否按总-分结构推进",
            "result": "是否满足本章完成标准",
            "retrospective": "本章最需要改进的一个点是什么",
        },
        status="ready",
        approval_required=True,
    )


def build_curriculum_skeleton(project_summary: str, chapter_count: int) -> dict:
    chapters = [asdict(build_chapter(i, chapter_count)) for i in range(1, chapter_count + 1)]
    return {
        "project_summary": project_summary,
        "principles": [
            "先总后分",
            "系统化章节推进",
            "未获许可不展开正文",
            "仅输出结构，不输出具体知识点",
            "数学公式严格使用 LaTeX 渲染",
        ],
        "milestones": [
            {"name": "M1", "scope": "前半程章节", "acceptance": "完成章纲与检查点"},
            {"name": "M2", "scope": "全章节", "acceptance": "完成复盘与收口"},
        ],
        "chapters": chapters,
    }


def render_course_outline_markdown(skeleton: dict) -> str:
    lines = [
        "# 课程总览",
        "",
        f"- 项目摘要：{skeleton['project_summary']}",
        "",
        "## 执行原则",
    ]
    lines.extend([f"- {item}" for item in skeleton["principles"]])
    lines.append("")
    lines.append("## 里程碑")
    for milestone in skeleton["milestones"]:
        lines.append(f"- {milestone['name']}：{milestone['scope']}（验收：{milestone['acceptance']}）")
    lines.append("")
    lines.append("## 章节目录")
    for chapter in skeleton["chapters"]:
        lines.append(f"- {chapter['title']}（状态：{chapter['status']}）")
    lines.append("")
    return "\n".join(lines)


def render_chapter_markdown(chapter: dict) -> str:
    lines = [
        f"# {chapter['title']}",
        "",
        "## 一、章节总览（总）",
        f"- 本章目标：{chapter['goal']}",
        f"- 前后关系：{chapter['relation']}",
        f"- 许可状态：{'待许可' if chapter['approval_required'] else '可讲解'}",
        "",
        "## 二、分节计划（分）",
    ]
    for i, section in enumerate(chapter["sections"], start=1):
        lines.extend(
            [
                f"### 2.{i} {section['name']}",
                f"- 分节目标：{section['goal']}",
                f"- 产出物：{section['output']}",
                "",
            ]
        )
    lines.extend(
        [
            "## 三、公式渲染区块（如涉及公式）",
            "- 行内公式：`$...$`",
            "- 块级公式：`$$...$$`",
            "- 无公式时请标注：本章无公式内容",
            "",
            "## 四、本章检查点",
            f"- 过程检查：{chapter['checkpoint']['process']}",
            f"- 结果检查：{chapter['checkpoint']['result']}",
            f"- 复盘问题：{chapter['checkpoint']['retrospective']}",
            "- 公式检查：是否全部可按 LaTeX 渲染",
            "",
            "## 五、许可门禁",
            "当前章节骨架已完成。若你同意，我将开始本章讲解正文；若不同意，我将先调整本章结构。",
            "",
        ]
    )
    return "\n".join(lines)


def write_markdown_files(skeleton: dict, output_dir: Path) -> list[str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    created: list[str] = []

    outline_path = output_dir / "course-outline.md"
    outline_path.write_text(render_course_outline_markdown(skeleton), encoding="utf-8")
    created.append(str(outline_path))

    for index, chapter in enumerate(skeleton["chapters"], start=1):
        chapter_path = output_dir / f"chapter-{index:02d}.md"
        chapter_path.write_text(render_chapter_markdown(chapter), encoding="utf-8")
        created.append(str(chapter_path))

    progress_path = output_dir / "progress-log.md"
    progress_lines = [
        "# 学习进度日志",
        "",
        "| 章节 | 状态 | 下一步 |",
        "| --- | --- | --- |",
    ]
    for chapter in skeleton["chapters"]:
        progress_lines.append(f"| {chapter['title']} | {chapter['status']} | 等待许可 |")
    progress_lines.append("")
    progress_path.write_text("\n".join(progress_lines), encoding="utf-8")
    created.append(str(progress_path))

    return created


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate project learning skeleton")
    parser.add_argument("--project-summary", required=True, help="Short project summary")
    parser.add_argument("--chapter-count", type=int, default=6, help="Number of chapters")
    parser.add_argument(
        "--output-dir",
        default="./learning",
        help="Directory to write markdown course files",
    )
    args = parser.parse_args()

    if args.chapter_count < 1:
        raise SystemExit("chapter-count must be >= 1")

    skeleton = build_curriculum_skeleton(args.project_summary.strip(), args.chapter_count)
    created_files = write_markdown_files(skeleton, Path(args.output_dir))
    skeleton["written_files"] = created_files
    print(json.dumps(skeleton, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
