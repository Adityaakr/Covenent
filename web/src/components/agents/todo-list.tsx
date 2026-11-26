"use client";

/* TodoList (beUI's todo-list): an ordered plan whose steps move pending → in progress → completed (or cancelled). */
import { Icon } from "@/components/app/icons";
import { ThinkingMark } from "@/components/app/mark";
import { cx } from "@/components/app/ui";

export type TodoStatus = "pending" | "in-progress" | "completed" | "cancelled";
export interface TodoItem { id: string; title: string; status: TodoStatus; detail?: string }

export function TodoList({ items, title, className }: { items: TodoItem[]; title?: string; className?: string }) {
  const done = items.filter((i) => i.status === "completed").length;
  return (
    <div className={cx("ag-todo", className)}>
      {title ? <div className="ag-todo-head"><span>{title}</span><span className="faint num">{done} of {items.length}</span></div> : null}
      <ol>
        {items.map((it, i) => (
          <li key={it.id} className={cx("ag-todo-item", `is-${it.status}`)}>
            <span className="ag-todo-mark" aria-hidden="true">
              {it.status === "completed" ? <Icon name="check" size={12} strokeWidth={2.2} /> : it.status === "in-progress" ? <ThinkingMark size={12} /> : it.status === "cancelled" ? <Icon name="x" size={12} strokeWidth={2} /> : i + 1}
            </span>
            <span className="ag-todo-title">{it.title}{it.detail ? <span className="ag-todo-detail">{it.detail}</span> : null}</span>
            <span className="ag-sr">{it.status.replace("-", " ")}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
