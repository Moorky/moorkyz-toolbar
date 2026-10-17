"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  APPLICATIONS,
  COMMANDS,
  type ApplicationId,
  type CommandId,
} from "./playground-design";

export interface ApplicationHost {
  dispatch(command: CommandId): void;
}
const INITIAL_TASKS = [
  { id: 1, title: "Explore your new workspace", done: true },
  { id: 2, title: "Make the toolbar your own", done: false },
  { id: 3, title: "Export a local Vanilla starter", done: false },
];
const INITIAL_CARDS = [
  { id: 1, title: "Define the experience", stage: 0 },
  { id: 2, title: "Build with real actions", stage: 1 },
  { id: 3, title: "Verify the integration", stage: 2 },
];
const REVENUE = [
  { name: "Canvas", segment: "Core", week: 1200, month: 4800 },
  { name: "Atlas", segment: "Enterprise", week: 2400, month: 9200 },
  { name: "Studio", segment: "Core", week: 1800, month: 7000 },
  { name: "Orbit", segment: "Enterprise", week: 900, month: 3600 },
];
const STAGES = ["Planned", "In progress", "Done"];

export const PlaygroundApplications = forwardRef<
  ApplicationHost,
  {
    readonly application: ApplicationId;
    readonly contextual: boolean;
    readonly onStatus: (message: string) => void;
    readonly onAvailable: (commands: readonly string[]) => void;
    readonly children?: ReactNode;
  }
>(function PlaygroundApplications(
  { application, contextual, onStatus, onAvailable, children },
  ref,
) {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [showCompleted, setShowCompleted] = useState(true);
  const [titles, setTitles] = useState({ workspace: "", board: "" });
  const title = application === "workspace" ? titles.workspace : titles.board;
  function setTitle(value: string) {
    if (application === "workspace" || application === "board")
      setTitles((current) => ({ ...current, [application]: value }));
  }
  const [documentText, setDocumentText] = useState(
    "A toolbar should belong to your application.\n\nSelect some text, then use Uppercase selection in the real toolbar. Your document stays local to this page.",
  );
  const documentValue = useRef(documentText);
  const documentInput = useRef<HTMLTextAreaElement>(null);
  const updateDocument = useCallback((value: string) => {
    documentValue.current = value;
    setDocumentText(value);
  }, []);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  useEffect(() => {
    const editor = documentInput.current;
    if (
      application === "document" &&
      editor !== null &&
      (editor.selectionStart !== selection.start ||
        editor.selectionEnd !== selection.end)
    )
      editor.setSelectionRange(selection.start, selection.end);
  }, [application, documentText, selection]);
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [enterprise, setEnterprise] = useState(false);
  const [descending, setDescending] = useState(false);
  const [cards, setCards] = useState(INITIAL_CARDS);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const nextTask = useRef(4);
  const nextCard = useRef(4);
  const allowed = useMemo(
    () =>
      COMMANDS.filter(
        (command) =>
          command.application === application &&
          (command.id !== "document-uppercase" ||
            !contextual ||
            selection.end > selection.start) &&
          (command.id !== "board-advance" ||
            cards.some(({ id, stage }) => id === selectedCard && stage < 2)),
      ).map(({ id }) => id),
    [application, contextual, selection, selectedCard, cards],
  );

  useEffect(() => {
    onAvailable(allowed);
  }, [allowed, onAvailable]);

  const dispatch = useCallback(
    (command: CommandId) => {
      if (!allowed.includes(command))
        throw new Error(
          "This command is unavailable in the current application context.",
        );
      switch (command) {
        case "add-task":
        case "board-add":
          input.current?.focus();
          onStatus(
            application === "board"
              ? "Enter a card title, then add it to Planned."
              : "Enter a task title, then choose Add task.",
          );
          break;
        case "toggle-completed":
          setShowCompleted((value) => !value);
          onStatus("Completed task visibility changed.");
          break;
        case "clear-completed":
          setTasks((value) => value.filter(({ done }) => !done));
          onStatus("Completed sample tasks cleared.");
          break;
        case "document-heading":
          if (
            documentValue.current.length + "# Untitled section\n\n".length >
            10000
          ) {
            onStatus(
              "The sample document limit is 10,000 characters. Your current text is unchanged.",
            );
            break;
          }
          updateDocument(`# Untitled section\n\n${documentValue.current}`);
          setSelection({ start: 0, end: 0 });
          onStatus("Heading inserted in the local document.");
          break;
        case "document-uppercase": {
          const start = selection.end > selection.start ? selection.start : 0;
          const end =
            selection.end > selection.start
              ? selection.end
              : documentValue.current.length;
          const value = documentValue.current;
          const transformed = value.slice(start, end).toUpperCase();
          const next = value.slice(0, start) + transformed + value.slice(end);
          if (next.length > 10000) {
            onStatus(
              "The sample document limit is 10,000 characters. Your current text is unchanged.",
            );
            break;
          }
          updateDocument(next);
          setSelection({ start, end: start + transformed.length });
          onStatus("Selected document text converted to uppercase.");
          break;
        }
        case "document-count":
          onStatus(
            `${new Intl.NumberFormat("en").format(documentValue.current.trim().split(/\s+/).filter(Boolean).length)} words in the current document.`,
          );
          break;
        case "analytics-period":
          setPeriod((value) => (value === "week" ? "month" : "week"));
          onStatus("Analytics reporting period changed.");
          break;
        case "analytics-filter":
          setEnterprise((value) => !value);
          onStatus("Enterprise segment filter changed.");
          break;
        case "analytics-sort":
          setDescending((value) => !value);
          onStatus("Revenue sort order changed.");
          break;
        case "board-advance":
          setCards((value) =>
            value.map((card) =>
              card.id === selectedCard
                ? { ...card, stage: Math.min(2, card.stage + 1) }
                : card,
            ),
          );
          onStatus("Selected card advanced one stage.");
          break;
        case "board-archive":
          setCards((value) => value.filter(({ stage }) => stage !== 2));
          setSelectedCard(null);
          onStatus("Completed cards archived from the local board.");
          break;
      }
    },
    [allowed, application, onStatus, selectedCard, selection, updateDocument],
  );
  useImperativeHandle(ref, () => ({ dispatch }), [dispatch]);

  function reset() {
    if (application === "workspace") {
      setTasks(INITIAL_TASKS);
      setShowCompleted(true);
      nextTask.current = 4;
    }
    if (application === "document") {
      updateDocument(
        "A fresh page. Select text to reveal a formatting command.",
      );
      setSelection({ start: 0, end: 0 });
    }
    if (application === "analytics") {
      setPeriod("week");
      setEnterprise(false);
      setDescending(false);
    }
    if (application === "board") {
      setCards(INITIAL_CARDS);
      setSelectedCard(null);
      nextCard.current = 4;
    }
    setTitle("");
    onStatus("Sample application reset. Your toolbar design is unchanged.");
  }
  const rows = REVENUE.filter(
    (row) => !enterprise || row.segment === "Enterprise",
  ).sort((a, b) =>
    descending ? b[period] - a[period] : a.name.localeCompare(b.name, "en"),
  );
  const total = rows.reduce((sum, row) => sum + row[period], 0);
  const currency = new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <>
      <div className="workspace-app-header">
        <span className="eyebrow">
          MOORKYZ / {APPLICATIONS.find(({ id }) => id === application)?.name}
        </span>
        <span>Interactive local sample</span>
      </div>
      <div className="playground-stage">
        <div className="workspace-app-content">
          {application === "workspace" && (
            <>
              <p className="eyebrow">TODAY&apos;S FOCUS</p>
              <h3>A little room to do good work.</h3>
              <p>
                {tasks.filter(({ done }) => !done).length} open tasks · local
                sample data
              </p>
            </>
          )}
          {application === "board" && (
            <>
              <p className="eyebrow">A SMALL TEAM, CLEAR NEXT STEPS</p>
              <h3>Make progress visible.</h3>
              <p>Select a card to enable its contextual toolbar command.</p>
            </>
          )}
          {(application === "workspace" || application === "board") && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!title.trim()) {
                  onStatus("Enter a title before adding an item.");
                  return;
                }
                if (
                  (application === "workspace" ? tasks : cards).length >= 50
                ) {
                  onStatus(
                    "This local demonstration supports up to 50 items. Archive completed work or reset the sample.",
                  );
                  return;
                }
                const id =
                  application === "workspace"
                    ? nextTask.current++
                    : nextCard.current++;
                const itemTitle = title.trim();
                if (application === "workspace")
                  setTasks((value) => [
                    ...value,
                    { id, title: itemTitle, done: false },
                  ]);
                else
                  setCards((value) => [
                    ...value,
                    { id, title: itemTitle, stage: 0 },
                  ]);
                setTitle("");
                input.current?.focus();
                onStatus(
                  "Item added to the local application. Application contents are not persisted.",
                );
              }}
            >
              <label className="sr-only" htmlFor="workspace-task">
                {application === "workspace"
                  ? "New task title"
                  : "New card title"}
              </label>
              <input
                ref={input}
                id="workspace-task"
                value={title}
                placeholder="What needs your attention?"
                maxLength={100}
                onChange={(event) => setTitle(event.currentTarget.value)}
              />
              <button type="submit">
                {application === "workspace" ? "Add task" : "Add card"}
              </button>
            </form>
          )}
          {application === "workspace" && (
            <>
              <ul className="workspace-tasks" aria-label="Workspace tasks">
                {tasks
                  .filter(({ done }) => showCompleted || !done)
                  .map((task) => (
                    <li key={task.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={task.done}
                          onChange={() =>
                            setTasks((value) =>
                              value.map((entry) =>
                                entry.id === task.id
                                  ? { ...entry, done: !entry.done }
                                  : entry,
                              ),
                            )
                          }
                        />
                        <span
                          className={task.done ? "task-complete" : undefined}
                        >
                          {task.title}
                        </span>
                      </label>
                      <span>{task.done ? "Done" : "To do"}</span>
                    </li>
                  ))}
              </ul>
              {tasks.filter(({ done }) => showCompleted || !done).length ===
                0 && (
                <p>No tasks in this view. Add a task or show completed work.</p>
              )}
            </>
          )}
          {application === "document" && (
            <>
              <p className="eyebrow">DOCUMENT / DRAFT</p>
              <h3>Good tools stay out of your way.</h3>
              <label htmlFor="playground-document">Document content</label>
              <textarea
                ref={documentInput}
                id="playground-document"
                rows={9}
                value={documentText}
                maxLength={10000}
                onChange={(event) => {
                  updateDocument(event.currentTarget.value);
                  setSelection({
                    start: event.currentTarget.selectionStart,
                    end: event.currentTarget.selectionEnd,
                  });
                }}
                onSelect={(event) => {
                  const { selectionStart: start, selectionEnd: end } =
                    event.currentTarget;
                  setSelection((current) =>
                    current.start === start && current.end === end
                      ? current
                      : { start, end },
                  );
                }}
              />
              <p>
                {selection.end - selection.start} characters selected.{" "}
                {contextual
                  ? "Uppercase selection is disabled until text is selected."
                  : "Context gating is off: uppercase applies to the whole document if nothing is selected."}
              </p>
            </>
          )}
          {application === "analytics" && (
            <>
              <p className="eyebrow">REVENUE / {period.toUpperCase()}</p>
              <h3>{currency.format(total)}</h3>
              <p>
                {enterprise ? "Enterprise segment" : "All segments"} ·{" "}
                {descending ? "Revenue, high to low" : "Name, A–Z"}
              </p>
              <svg
                className="analytics-chart"
                viewBox="0 0 440 120"
                role="img"
                aria-label={`Revenue chart for ${period}; ${rows.length} products`}
              >
                {rows.map((row, index) => (
                  <g key={row.name}>
                    <rect
                      x={index * 106 + 10}
                      y={108 - row[period] / 100}
                      width={72}
                      height={row[period] / 100}
                      rx={4}
                    />
                    <text x={index * 106 + 10} y={119}>
                      {row.name}
                    </text>
                  </g>
                ))}
              </svg>
              <table>
                <caption>Local sample revenue</caption>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Segment</th>
                    <th scope="col">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.name}>
                      <th scope="row">{row.name}</th>
                      <td>{row.segment}</td>
                      <td>{currency.format(row[period])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {application === "board" && (
            <div className="project-board">
              {STAGES.map((stage, index) => (
                <section key={stage} aria-label={stage}>
                  <h4>{stage}</h4>
                  {cards
                    .filter((card) => card.stage === index)
                    .map((card) => (
                      <label className="board-card" key={card.id}>
                        <input
                          type="radio"
                          name="selected-card"
                          checked={selectedCard === card.id}
                          onChange={() => setSelectedCard(card.id)}
                        />
                        <span>{card.title}</span>
                      </label>
                    ))}
                  {cards.every((card) => card.stage !== index) && (
                    <p>No cards</p>
                  )}
                </section>
              ))}
            </div>
          )}
          <button type="button" className="workspace-reset" onClick={reset}>
            Reset sample {application === "workspace" ? "tasks" : "application"}
          </button>
        </div>
        {children}
      </div>
    </>
  );
});
