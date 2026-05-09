// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
//
// Configurable Meters Panel (plan §3.6). One tile = one independent widget
// set, persisted in the FlexLayout TabNode.config blob (round-trips with
// the workspace JSON; no new storage layer).
//
// Layout:
//   ┌─────────────────────────────────────────────────────┐
//   │ ⚙ ◀  Title (dbl-click to rename)               ▶   │  ← 24 px header
//   ├─────────────────────────────────────────────────────┤
//   │ ┌──────────┐                       ┌──────────┐    │
//   │ │ LIBRARY  │       widget canvas   │ SETTINGS │    │
//   │ │ (overlay)│                       │ (overlay)│    │
//   │ └──────────┘                       └──────────┘    │
//   └─────────────────────────────────────────────────────┘
//
// The Library and Settings drawers are absolutely positioned over the
// widget canvas — they do not push content. CSS transitions on
// translateX use the existing --dur-fast / --dur-med tokens.

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
} from 'react';
import {
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FolderPlus,
  Plus,
  X,
  Trash2,
  GripVertical,
} from 'lucide-react';
import {
  ResponsiveGridLayout,
  useContainerWidth,
  type Layout,
  type LayoutItem,
} from 'react-grid-layout';
import {
  METER_CATALOG,
  METER_FILTERS,
  METER_READINGS,
  meterMatchesFilter,
  type MeterFilter,
  type MeterReadingId,
} from '../../components/meters/meterCatalog';
import {
  DEFAULT_WIDGET_SPAN,
  appendGroup,
  defaultWidgetForReading,
  EMPTY_METERS_CONFIG,
  METERS_GRID_COLS,
  METERS_GRID_ROW_HEIGHT_PX,
  METERS_WIDGET_KINDS,
  parseMetersPanelConfig,
  placeWidgetInGrid,
  reassignWidgetToGroup,
  removeGroup,
  widgetKindAllowed,
  type MetersPanelGroup,
  type MetersWidgetInstance,
  type MetersWidgetKind,
  type MetersPanelConfig,
} from '../../components/meters/metersConfig';
import { MeterWidget } from '../../components/meters/MeterWidget';

/** dataTransfer mime used for cross-group widget drag. Stable string —
 *  changing it breaks in-flight drags on a hot reload. */
const CROSS_GROUP_DT_MIME = 'application/x-zeus-meter-widget-uid';

interface MetersPanelProps {
  /** Per-instance config blob. Provided by `PanelTile` from the workspace
   *  store; defaults to EMPTY_METERS_CONFIG so the panel still renders if
   *  it's mounted standalone (tests, design previews). */
  config?: MetersPanelConfig;
  /** Persistence hook. The workspace store wires this to
   *  `updateTileInstanceConfig(uid, next)`. No-op default keeps the panel
   *  usable in non-persistent contexts. */
  setConfig?: (next: MetersPanelConfig) => void;
  /** Optional title-rename callback. Reserved for future workspace-level
   *  rename UX (the v1 workspace doesn't use this — see all-panels plan §10
   *  Q3). MetersPanel still owns the in-header title editor. */
  renameTab?: (name: string) => void;
  /** Tile-removal hook. Injected by PanelTile because Meters opts out of
   *  the default TileChrome (panels.ts → headerless: true) and renders its
   *  own close X. Falls back to no-op when the panel is mounted standalone
   *  (tests, design previews). */
  onRemove?: () => void;
}

export function MetersPanel({
  config,
  setConfig,
  renameTab,
  onRemove,
}: MetersPanelProps) {
  const effectiveConfig = config ?? EMPTY_METERS_CONFIG;
  const effectiveSet = setConfig ?? noop;
  return (
    <MetersPanelInner
      config={effectiveConfig}
      setConfig={effectiveSet}
      renameTab={renameTab}
      onRemove={onRemove}
    />
  );
}

function noop() {}

interface MetersPanelInnerProps {
  config: MetersPanelConfig;
  setConfig: (next: MetersPanelConfig) => void;
  renameTab?: (name: string) => void;
  onRemove?: () => void;
}

export function MetersPanelInner({
  config,
  setConfig,
  renameTab,
  onRemove,
}: MetersPanelInnerProps) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [filter, setFilter] = useState<MeterFilter>('all');
  const [search, setSearch] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(config.title ?? '');

  // Groups sorted lowest-order-first so cross-group drop fall-through and
  // "active group for new widgets" both have a stable target.
  const sortedGroups = useMemo(
    () => [...config.groups].sort((a, b) => a.order - b.order),
    [config.groups],
  );

  // Active group: where library-add lands. Defaults to the lowest-order
  // group; updated when the operator adds a new group (jumps to it). When
  // the active group is removed, falls back to the new lowest-order.
  const [activeGroupUid, setActiveGroupUid] = useState<string>(
    () => sortedGroups[0]?.uid ?? '',
  );
  // If the active group disappears (parser dropped it, operator deleted),
  // re-anchor to the lowest-order remaining one. Cheap to recompute on
  // every render — the array is short.
  const effectiveActiveGroupUid = useMemo(() => {
    if (sortedGroups.some((g) => g.uid === activeGroupUid)) {
      return activeGroupUid;
    }
    return sortedGroups[0]?.uid ?? '';
  }, [sortedGroups, activeGroupUid]);

  const settingsOpen = selectedUid !== null;
  const selectedWidget = useMemo(
    () => config.widgets.find((w) => w.uid === selectedUid) ?? null,
    [config.widgets, selectedUid],
  );

  const title = config.title ?? 'Meters';

  const updateWidget = useCallback(
    (uid: string, patch: Partial<MetersWidgetInstance>) => {
      const next: MetersPanelConfig = {
        ...config,
        widgets: config.widgets.map((w) =>
          w.uid === uid ? { ...w, ...patch, settings: { ...w.settings, ...(patch.settings ?? {}) } } : w,
        ),
      };
      setConfig(next);
    },
    [config, setConfig],
  );

  const removeWidget = useCallback(
    (uid: string) => {
      const next: MetersPanelConfig = {
        ...config,
        widgets: config.widgets.filter((w) => w.uid !== uid),
      };
      setConfig(next);
      setSelectedUid(null);
    },
    [config, setConfig],
  );

  const addWidget = useCallback(
    (id: MeterReadingId) => {
      const fresh = defaultWidgetForReading(id, effectiveActiveGroupUid);
      // Auto-place the new widget at the next free row inside its group;
      // the grid will compact upward at render time.
      const placed = placeWidgetInGrid(fresh, config.widgets);
      const next: MetersPanelConfig = {
        ...config,
        widgets: [...config.widgets, placed],
      };
      setConfig(next);
      // Auto-select the new widget so the operator sees its config knobs
      // ready in the Settings drawer if they want to tweak it.
      setSelectedUid(placed.uid);
    },
    [config, setConfig, effectiveActiveGroupUid],
  );

  // Append a fresh group, jump the active-group cursor to it so the next
  // library add lands inside.
  const addGroup = useCallback(() => {
    const { config: next, group } = appendGroup(config);
    setConfig(next);
    setActiveGroupUid(group.uid);
  }, [config, setConfig]);

  // Delete a group and reassign its widgets. The metersConfig helper
  // refuses to remove the last remaining group; we mirror that intent in
  // the trash button's disabled state.
  const removeGroupHandler = useCallback(
    (groupUid: string) => {
      const next = removeGroup(config, groupUid);
      if (next === config) return;
      setConfig(next);
      // If the active group was the one we just removed, re-anchor to the
      // first remaining (lowest-order) group.
      if (activeGroupUid === groupUid) {
        const sorted = [...next.groups].sort((a, b) => a.order - b.order);
        setActiveGroupUid(sorted[0]?.uid ?? '');
      }
    },
    [config, setConfig, activeGroupUid],
  );

  const renameGroup = useCallback(
    (groupUid: string, nextTitle: string) => {
      const trimmed = nextTitle.trim();
      if (trimmed === '') return;
      let changed = false;
      const groups = config.groups.map((g) => {
        if (g.uid !== groupUid) return g;
        if (g.title === trimmed) return g;
        changed = true;
        return { ...g, title: trimmed };
      });
      if (!changed) return;
      setConfig({ ...config, groups });
    },
    [config, setConfig],
  );

  const toggleGroupCollapsed = useCallback(
    (groupUid: string) => {
      const groups = config.groups.map((g) => {
        if (g.uid !== groupUid) return g;
        const next: MetersPanelGroup = { ...g, collapsed: !g.collapsed };
        if (!next.collapsed) delete next.collapsed;
        return next;
      });
      setConfig({ ...config, groups });
    },
    [config, setConfig],
  );

  // Cross-group drop handler: the panel owns the reassign because the
  // group sections share `setConfig` through here; each GroupSection
  // wires its own onDragOver/onDrop to a local callback that hits this.
  const reassignWidget = useCallback(
    (widgetUid: string, targetGroupUid: string) => {
      const next = reassignWidgetToGroup(config, widgetUid, targetGroupUid);
      if (next === config) return;
      setConfig(next);
    },
    [config, setConfig],
  );

  // Apply auto-placement at render time for any widget that came in without
  // `layout` (cross-group reassignment clears layout; legacy widgets may
  // not have one yet). Walk each group independently so widgets in group B
  // don't pile up below group A's tallest column.
  const placedWidgets = useMemo(() => {
    const out: MetersWidgetInstance[] = [];
    for (const w of config.widgets) {
      if (w.layout) {
        out.push(w);
      } else {
        out.push(placeWidgetInGrid(w, out));
      }
    }
    return out;
  }, [config.widgets]);

  // Per-group layout-change handler. Only updates widgets that belong to
  // the group whose canvas just emitted the change — RGL passes layouts
  // for every grid item in that one canvas, so we only touch those.
  const onGroupLayoutChange = useCallback(
    (groupUid: string, next: Layout) => {
      const byUid = new Map<string, LayoutItem>(next.map((l) => [l.i, l]));
      let changed = false;
      const widgets = placedWidgets.map((w) => {
        if (w.groupUid !== groupUid) return w;
        const l = byUid.get(w.uid);
        if (!l) return w;
        const cur = w.layout;
        if (
          cur &&
          cur.x === l.x &&
          cur.y === l.y &&
          cur.w === l.w &&
          cur.h === l.h
        ) {
          return w;
        }
        changed = true;
        return { ...w, layout: { x: l.x, y: l.y, w: l.w, h: l.h } };
      });
      if (changed) {
        setConfig({ ...config, widgets });
      }
    },
    [config, placedWidgets, setConfig],
  );

  const commitTitle = useCallback(() => {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (trimmed === '' || trimmed === title) {
      setTitleDraft(title);
      return;
    }
    setConfig({ ...config, title: trimmed });
    if (renameTab) renameTab(trimmed);
  }, [titleDraft, title, config, setConfig, renameTab]);

  // The Meters tile is registered with PanelDef.headerless = true, so
  // PanelTile skips the default TileChrome. The header below takes over
  // that role: the wrapping element carries class `workspace-tile-header`
  // (so RGL drag still works) and the right-side X carries
  // `workspace-tile-close` (drag-cancel selector). Buttons in between
  // (gear / chevrons) stop mousedown propagation so a click on them
  // doesn't initiate a drag.
  const headerBtnStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    borderRadius: 'var(--r-xs)',
    color: 'var(--fg-1)',
    background: 'transparent',
    transition: 'background var(--dur-fast)',
  };
  const titleStyle: CSSProperties = {
    flex: 1,
    fontSize: 11,
    fontFamily: 'var(--font-sans)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--fg-1)',
    cursor: 'text',
    userSelect: 'none',
  };
  const stopDrag = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      data-testid="meters-panel"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--bg-0)',
      }}
    >
      {/* Header — see PanelDef.headerless wiring above. The class
          `workspace-tile-header` makes this strip the RGL drag handle for
          the surrounding tile. */}
      <div className="workspace-tile-header">
        <span
          className="workspace-tile-drag-handle"
          aria-hidden="true"
          title="Drag to reposition"
        >
          <GripVertical size={12} />
        </span>
        <button
          type="button"
          aria-label={libraryOpen ? 'Close meter library' : 'Open meter library'}
          aria-pressed={libraryOpen}
          title={libraryOpen ? 'Close library' : 'Add meters'}
          onClick={() => setLibraryOpen((o) => !o)}
          onMouseDown={stopDrag}
          style={headerBtnStyle}
          data-testid="meters-library-toggle"
        >
          <Settings size={14} />
        </button>
        <button
          type="button"
          aria-label="Add group"
          title="Add group"
          onClick={addGroup}
          onMouseDown={stopDrag}
          style={headerBtnStyle}
          data-testid="meters-add-group"
        >
          <FolderPlus size={14} />
        </button>
        {libraryOpen ? (
          <button
            type="button"
            aria-label="Collapse drawer"
            title="Collapse drawer"
            onClick={() => setLibraryOpen(false)}
            onMouseDown={stopDrag}
            style={headerBtnStyle}
          >
            <ChevronLeft size={14} />
          </button>
        ) : null}
        {editingTitle ? (
          <input
            type="text"
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onMouseDown={stopDrag}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              else if (e.key === 'Escape') {
                setEditingTitle(false);
                setTitleDraft(title);
              }
            }}
            style={{
              ...titleStyle,
              background: 'var(--bg-2)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--r-xs)',
              padding: '0 4px',
              outline: 'none',
            }}
          />
        ) : (
          <span
            className="workspace-tile-title"
            style={{ cursor: 'text' }}
            onDoubleClick={() => {
              setTitleDraft(title);
              setEditingTitle(true);
            }}
            title="Double-click to rename"
          >
            {title}
          </span>
        )}
        {settingsOpen ? (
          <button
            type="button"
            aria-label="Close settings"
            title="Close settings"
            onClick={() => setSelectedUid(null)}
            onMouseDown={stopDrag}
            style={headerBtnStyle}
          >
            <ChevronRight size={14} />
          </button>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            className="workspace-tile-close"
            aria-label={`Remove ${title}`}
            title="Remove panel"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <X size={12} />
          </button>
        ) : null}
      </div>

      {/* Widget canvas stack — one RGL canvas per group, stacked
          vertically. Groups are rendered lowest-order first; cross-group
          drops dispatch through the panel's `reassignWidget` callback
          while intra-group drags keep using the existing RGL grip. */}
      <GroupCanvasStack
        groups={sortedGroups}
        widgets={placedWidgets}
        activeGroupUid={effectiveActiveGroupUid}
        selectedUid={selectedUid}
        onSelectWidget={(uid) =>
          setSelectedUid((current) => (current === uid ? null : uid))
        }
        onRemoveWidget={removeWidget}
        onLayoutChange={onGroupLayoutChange}
        onReassignWidget={reassignWidget}
        onActivateGroup={setActiveGroupUid}
        onToggleCollapsed={toggleGroupCollapsed}
        onRenameGroup={renameGroup}
        onAddGroup={addGroup}
        onRemoveGroup={removeGroupHandler}
      />

      {/* Library drawer (left) */}
      <LibraryDrawer
        open={libraryOpen}
        filter={filter}
        setFilter={setFilter}
        search={search}
        setSearch={setSearch}
        existing={config.widgets}
        onAdd={addWidget}
        onClose={() => setLibraryOpen(false)}
      />

      {/* Settings drawer (right) */}
      <SettingsDrawer
        open={settingsOpen}
        widget={selectedWidget}
        onChange={(patch) => {
          if (selectedWidget) updateWidget(selectedWidget.uid, patch);
        }}
        onRemove={() => {
          if (selectedWidget) removeWidget(selectedWidget.uid);
        }}
        onClose={() => setSelectedUid(null)}
      />
    </div>
  );
}

interface LibraryDrawerProps {
  open: boolean;
  filter: MeterFilter;
  setFilter: (f: MeterFilter) => void;
  search: string;
  setSearch: (s: string) => void;
  existing: MetersWidgetInstance[];
  onAdd: (id: MeterReadingId) => void;
  onClose: () => void;
}

interface GroupCanvasStackProps {
  groups: ReadonlyArray<MetersPanelGroup>;
  widgets: MetersWidgetInstance[];
  activeGroupUid: string;
  selectedUid: string | null;
  onSelectWidget: (uid: string) => void;
  onRemoveWidget: (uid: string) => void;
  onLayoutChange: (groupUid: string, next: Layout) => void;
  onReassignWidget: (widgetUid: string, targetGroupUid: string) => void;
  onActivateGroup: (groupUid: string) => void;
  onToggleCollapsed: (groupUid: string) => void;
  onRenameGroup: (groupUid: string, nextTitle: string) => void;
  onAddGroup: () => void;
  onRemoveGroup: (groupUid: string) => void;
}

function GroupCanvasStack({
  groups,
  widgets,
  activeGroupUid,
  selectedUid,
  onSelectWidget,
  onRemoveWidget,
  onLayoutChange,
  onReassignWidget,
  onActivateGroup,
  onToggleCollapsed,
  onRenameGroup,
  onAddGroup,
  onRemoveGroup,
}: GroupCanvasStackProps) {
  const totalWidgets = widgets.length;
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
      data-testid="meters-canvas"
    >
      {groups.map((group) => {
        const groupWidgets = widgets.filter((w) => w.groupUid === group.uid);
        return (
          <GroupSection
            key={group.uid}
            group={group}
            widgets={groupWidgets}
            isOnlyGroup={groups.length <= 1}
            isActive={group.uid === activeGroupUid}
            isPanelEmpty={totalWidgets === 0}
            groupCount={groups.length}
            selectedUid={selectedUid}
            onSelectWidget={(uid) => {
              onActivateGroup(group.uid);
              onSelectWidget(uid);
            }}
            onRemoveWidget={onRemoveWidget}
            onLayoutChange={(next) => onLayoutChange(group.uid, next)}
            onReassignWidget={onReassignWidget}
            onActivate={() => onActivateGroup(group.uid)}
            onToggleCollapsed={() => onToggleCollapsed(group.uid)}
            onRename={(title) => onRenameGroup(group.uid, title)}
            onRemoveSelf={() => onRemoveGroup(group.uid)}
          />
        );
      })}
      {/* Discoverability ghost-button — same effect as the header's
          FolderPlus, but lives at the bottom of the canvas where new
          operators look for "where do I add another section?". */}
      <button
        type="button"
        onClick={onAddGroup}
        data-testid="meters-add-group-bottom"
        style={{
          margin: '6px 6px 12px',
          padding: '6px 10px',
          background: 'transparent',
          border: '1px dashed var(--panel-border)',
          borderRadius: 'var(--r-xs)',
          color: 'var(--fg-3)',
          fontSize: 11,
          fontFamily: 'var(--font-sans)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          cursor: 'pointer',
        }}
      >
        <Plus size={12} />
        New group
      </button>
    </div>
  );
}

interface GroupSectionProps {
  group: MetersPanelGroup;
  widgets: MetersWidgetInstance[];
  isOnlyGroup: boolean;
  isActive: boolean;
  isPanelEmpty: boolean;
  groupCount: number;
  selectedUid: string | null;
  onSelectWidget: (uid: string) => void;
  onRemoveWidget: (uid: string) => void;
  onLayoutChange: (next: Layout) => void;
  onReassignWidget: (widgetUid: string, targetGroupUid: string) => void;
  onActivate: () => void;
  onToggleCollapsed: () => void;
  onRename: (nextTitle: string) => void;
  onRemoveSelf: () => void;
}

function GroupSection({
  group,
  widgets,
  isOnlyGroup,
  isActive,
  isPanelEmpty,
  groupCount,
  selectedUid,
  onSelectWidget,
  onRemoveWidget,
  onLayoutChange,
  onReassignWidget,
  onActivate,
  onToggleCollapsed,
  onRename,
  onRemoveSelf,
}: GroupSectionProps) {
  const { width, containerRef, mounted } = useContainerWidth();
  const [isDropTarget, setIsDropTarget] = useState(false);
  const dragDepthRef = useRef(0);

  // Cross-group drop: accept the drag when the dataTransfer carries our
  // mime, set a visible drop-target highlight, dispatch the reassign on
  // drop. Intra-group RGL drags don't touch dataTransfer at all and so
  // never trigger this path.
  const onDragOver = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(CROSS_GROUP_DT_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);
  const onDragEnter = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(CROSS_GROUP_DT_MIME)) return;
    dragDepthRef.current += 1;
    setIsDropTarget(true);
  }, []);
  const onDragLeave = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(CROSS_GROUP_DT_MIME)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDropTarget(false);
  }, []);
  const onDrop = useCallback(
    (e: ReactDragEvent<HTMLDivElement>) => {
      const widgetUid = e.dataTransfer.getData(CROSS_GROUP_DT_MIME);
      if (!widgetUid) return;
      e.preventDefault();
      dragDepthRef.current = 0;
      setIsDropTarget(false);
      onReassignWidget(widgetUid, group.uid);
    },
    [group.uid, onReassignWidget],
  );

  return (
    <section
      data-testid="meters-group-section"
      data-group-uid={group.uid}
      onClick={onActivate}
      style={{
        display: 'flex',
        flexDirection: 'column',
        marginBottom: 6,
      }}
    >
      <GroupHeader
        group={group}
        isOnlyGroup={isOnlyGroup}
        isActive={isActive}
        widgetCount={widgets.length}
        onToggleCollapsed={onToggleCollapsed}
        onRename={onRename}
        onRemoveSelf={onRemoveSelf}
      />
      {!group.collapsed && (
        <div
          ref={containerRef}
          data-testid="meters-group-canvas"
          data-group-uid={group.uid}
          onDragOver={onDragOver}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          style={{
            position: 'relative',
            border: isDropTarget
              ? '1px dashed var(--accent)'
              : '1px solid transparent',
            borderRadius: 'var(--r-xs)',
            transition: 'border-color var(--dur-fast)',
            minHeight: 60,
          }}
        >
          {widgets.length === 0 ? (
            // Empty group canvas — keep a "drag-here" affordance even
            // when there are no widgets in this group. The first group
            // also doubles as the panel-wide empty state when no widgets
            // exist anywhere (preserves the legacy
            // [data-testid="meters-empty-state"] selector).
            <div
              style={{
                padding: 18,
                textAlign: 'center',
                color: 'var(--fg-3)',
                fontSize: 11,
                fontFamily: 'var(--font-sans)',
                fontStyle: 'italic',
              }}
              {...(isPanelEmpty ? { 'data-testid': 'meters-empty-state' } : {})}
            >
              {isPanelEmpty
                ? 'No meters yet — tap ⚙ to configure.'
                : groupCount > 1
                  ? 'Empty — drag a widget in from another group.'
                  : 'Empty — tap ⚙ to add a meter.'}
            </div>
          ) : !mounted ? (
            // Reserve space silently while ResizeObserver measures.
            <div style={{ minHeight: 80 }} aria-hidden />
          ) : (
            <ResponsiveGridLayout
              className="meters-grid"
              width={width}
              breakpoints={{ lg: 0 }}
              cols={{ lg: METERS_GRID_COLS }}
              rowHeight={METERS_GRID_ROW_HEIGHT_PX}
              margin={[6, 6]}
              containerPadding={[6, 6]}
              dragConfig={{ handle: '.meter-widget-drag-handle', bounded: false }}
              onLayoutChange={onLayoutChange}
              layouts={{
                lg: widgets.map((w) => ({
                  i: w.uid,
                  x: w.layout?.x ?? 0,
                  y: w.layout?.y ?? 0,
                  w: w.layout?.w ?? DEFAULT_WIDGET_SPAN[w.kind].w,
                  h: w.layout?.h ?? DEFAULT_WIDGET_SPAN[w.kind].h,
                  minW: 2,
                  minH: 2,
                })),
              }}
            >
              {widgets.map((w) => (
                <div key={w.uid} data-grid-uid={w.uid}>
                  <MeterWidget
                    widget={w}
                    groupCount={groupCount}
                    selected={w.uid === selectedUid}
                    onSelect={() => onSelectWidget(w.uid)}
                    onRemove={() => onRemoveWidget(w.uid)}
                  />
                </div>
              ))}
            </ResponsiveGridLayout>
          )}
        </div>
      )}
    </section>
  );
}

interface GroupHeaderProps {
  group: MetersPanelGroup;
  isOnlyGroup: boolean;
  isActive: boolean;
  widgetCount: number;
  onToggleCollapsed: () => void;
  onRename: (nextTitle: string) => void;
  onRemoveSelf: () => void;
}

function GroupHeader({
  group,
  isOnlyGroup,
  isActive,
  widgetCount,
  onToggleCollapsed,
  onRename,
  onRemoveSelf,
}: GroupHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.title);
  // Keep draft synced when title changes externally (e.g. another tab).
  // Cheap to do unconditionally — the input only renders while editing.
  if (!editing && draft !== group.title) {
    setDraft(group.title);
  }
  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === '' || trimmed === group.title) {
      setDraft(group.title);
      return;
    }
    onRename(trimmed);
  };
  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 6px',
    background: 'linear-gradient(90deg, var(--panel-top), var(--panel-bot))',
    borderTop: '1px solid var(--panel-border)',
    borderBottom: '1px solid var(--panel-border)',
    boxShadow: isActive ? 'inset 0 -1px 0 var(--accent)' : undefined,
  };
  const chevronBtnStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    color: 'var(--fg-2)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
  };
  const titleStyle: CSSProperties = {
    flex: 1,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.10em',
    color: 'var(--fg-1)',
    cursor: 'text',
    userSelect: 'none',
  };
  const trashBtnStyle: CSSProperties = {
    ...chevronBtnStyle,
    color: isOnlyGroup ? 'var(--fg-4)' : 'var(--fg-3)',
    cursor: isOnlyGroup ? 'not-allowed' : 'pointer',
    opacity: isOnlyGroup ? 0.4 : 1,
  };
  return (
    <div style={headerStyle} data-testid="meters-group-header">
      <button
        type="button"
        aria-label={group.collapsed ? 'Expand group' : 'Collapse group'}
        title={group.collapsed ? 'Expand' : 'Collapse'}
        onClick={(e) => {
          e.stopPropagation();
          onToggleCollapsed();
        }}
        style={chevronBtnStyle}
      >
        {group.collapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {editing ? (
        <input
          type="text"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') {
              setEditing(false);
              setDraft(group.title);
            }
          }}
          style={{
            ...titleStyle,
            background: 'var(--bg-2)',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--r-xs)',
            padding: '0 4px',
            outline: 'none',
            fontFamily: 'var(--font-sans)',
          }}
        />
      ) : (
        <span
          style={titleStyle}
          onDoubleClick={() => {
            setDraft(group.title);
            setEditing(true);
          }}
          title="Double-click to rename"
        >
          {group.title}
          <span style={{ marginLeft: 6, color: 'var(--fg-3)' }}>
            ({widgetCount})
          </span>
        </span>
      )}
      <button
        type="button"
        aria-label={`Remove group ${group.title}`}
        title={
          isOnlyGroup
            ? 'Cannot remove the last group'
            : `Remove group "${group.title}"`
        }
        disabled={isOnlyGroup}
        aria-disabled={isOnlyGroup}
        onClick={(e) => {
          e.stopPropagation();
          if (!isOnlyGroup) onRemoveSelf();
        }}
        data-testid="meters-remove-group"
        style={trashBtnStyle}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function LibraryDrawer({
  open,
  filter,
  setFilter,
  search,
  setSearch,
  existing,
  onAdd,
  onClose,
}: LibraryDrawerProps) {
  const term = search.trim().toLowerCase();
  const items = METER_READINGS.filter((def) => {
    if (!meterMatchesFilter(def, filter)) return false;
    if (term) {
      return (
        def.label.toLowerCase().includes(term) ||
        def.short.toLowerCase().includes(term) ||
        def.id.toLowerCase().includes(term)
      );
    }
    return true;
  });
  const existingIds = new Set(existing.map((w) => w.reading));

  return (
    <div
      role="dialog"
      aria-label="Meter library"
      aria-hidden={!open}
      style={{
        position: 'absolute',
        top: 24,
        bottom: 0,
        left: 0,
        width: 240,
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--panel-border)',
        boxShadow: 'var(--panel-shadow)',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform var(--dur-med) var(--ease-out)',
        overflowY: 'auto',
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
      }}
      data-testid="meters-library-drawer"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          borderBottom: '1px solid var(--panel-border)',
        }}
      >
        <span
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--fg-1)',
          }}
        >
          Library
        </span>
        <button
          type="button"
          aria-label="Close library"
          onClick={onClose}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 18,
            height: 18,
            color: 'var(--fg-2)',
          }}
        >
          <X size={12} />
        </button>
      </div>
      <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          type="text"
          placeholder="Search meters…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search meters"
          style={{
            padding: '4px 8px',
            background: 'var(--bg-0)',
            border: '1px solid var(--panel-border)',
            borderRadius: 'var(--r-xs)',
            color: 'var(--fg-0)',
            fontSize: 12,
          }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {METER_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              style={{
                padding: '2px 8px',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                borderRadius: 'var(--r-xs)',
                color:
                  filter === f ? 'var(--btn-active-text)' : 'var(--fg-1)',
                background:
                  filter === f
                    ? 'linear-gradient(180deg, var(--btn-active-top), var(--btn-active-bot))'
                    : 'linear-gradient(180deg, var(--btn-top), var(--btn-bot))',
                border: '1px solid var(--btn-edge)',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '0 4px 8px',
        }}
        data-testid="meters-library-list"
      >
        {items.length === 0 ? (
          <div
            style={{
              padding: 16,
              fontSize: 11,
              color: 'var(--fg-2)',
              textAlign: 'center',
            }}
          >
            No meters match
          </div>
        ) : (
          items.map((def) => {
            const already = existingIds.has(def.id);
            return (
              <button
                key={def.id}
                type="button"
                onClick={() => onAdd(def.id)}
                title={`Add "${def.label}" widget`}
                data-meter-id={def.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '4px 8px',
                  margin: '2px 0',
                  background: 'transparent',
                  border: '1px solid transparent',
                  borderRadius: 'var(--r-xs)',
                  textAlign: 'left',
                  color: 'var(--fg-1)',
                  fontSize: 12,
                  fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-2)';
                  e.currentTarget.style.borderColor = 'var(--panel-border)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <span>{def.label}</span>
                <span
                  aria-hidden="true"
                  style={{
                    fontSize: 9,
                    color: already ? 'var(--accent)' : 'var(--fg-3)',
                    textTransform: 'uppercase',
                  }}
                >
                  {already ? '+ another' : 'add'}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

interface SettingsDrawerProps {
  open: boolean;
  widget: MetersWidgetInstance | null;
  onChange: (patch: Partial<MetersWidgetInstance>) => void;
  onRemove: () => void;
  onClose: () => void;
}

function SettingsDrawer({
  open,
  widget,
  onChange,
  onRemove,
  onClose,
}: SettingsDrawerProps) {
  const def = widget ? METER_CATALOG[widget.reading] : null;
  return (
    <div
      role="dialog"
      aria-label="Widget settings"
      aria-hidden={!open}
      style={{
        position: 'absolute',
        top: 24,
        bottom: 0,
        right: 0,
        width: 240,
        background: 'var(--bg-1)',
        borderLeft: '1px solid var(--panel-border)',
        boxShadow: 'var(--panel-shadow)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform var(--dur-med) var(--ease-out)',
        overflowY: 'auto',
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
      }}
      data-testid="meters-settings-drawer"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          borderBottom: '1px solid var(--panel-border)',
        }}
      >
        <span
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--fg-1)',
          }}
        >
          Settings
        </span>
        <button
          type="button"
          aria-label="Close settings"
          onClick={onClose}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 18,
            height: 18,
            color: 'var(--fg-2)',
          }}
        >
          <X size={12} />
        </button>
      </div>
      {widget && def ? (
        <div
          style={{
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'var(--fg-2)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {def.label}
          </div>

          <SettingsField label="Kind">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {METERS_WIDGET_KINDS.map((k) => {
                // Render incompatible kinds greyed-out rather than hiding
                // them — operators see what kinds exist and learn which
                // primitives suit which readings, which they wouldn't
                // discover from a filtered list.
                const allowed = widgetKindAllowed(k, def);
                const active = widget.kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={active}
                    aria-disabled={!allowed}
                    disabled={!allowed}
                    onClick={() =>
                      allowed && onChange({ kind: k as MetersWidgetKind })
                    }
                    title={
                      allowed
                        ? `Render as ${k}`
                        : `${k} is not compatible with ${def.label}`
                    }
                    style={{
                      padding: '2px 8px',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      borderRadius: 'var(--r-xs)',
                      color: active
                        ? 'var(--btn-active-text)'
                        : 'var(--fg-1)',
                      background: active
                        ? 'linear-gradient(180deg, var(--btn-active-top), var(--btn-active-bot))'
                        : 'linear-gradient(180deg, var(--btn-top), var(--btn-bot))',
                      border: '1px solid var(--btn-edge)',
                      opacity: allowed ? 1 : 0.4,
                      cursor: allowed ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
          </SettingsField>

          <SettingsField label="Axis min">
            <NumberInput
              value={widget.settings.min ?? def.defaultMin}
              onChange={(v) => onChange({ settings: { min: v } })}
            />
          </SettingsField>
          <SettingsField label="Axis max">
            <NumberInput
              value={widget.settings.max ?? def.defaultMax}
              onChange={(v) => onChange({ settings: { max: v } })}
            />
          </SettingsField>

          <SettingsField label="Peak hold">
            <label
              style={{
                display: 'inline-flex',
                gap: 6,
                alignItems: 'center',
                fontSize: 11,
                color: 'var(--fg-1)',
              }}
            >
              <input
                type="checkbox"
                checked={widget.settings.peakHold !== false}
                onChange={(e) =>
                  onChange({ settings: { peakHold: e.target.checked } })
                }
              />
              Show peak tick
            </label>
          </SettingsField>

          <SettingsField label="Label">
            <input
              type="text"
              value={widget.settings.label ?? ''}
              placeholder={def.label}
              onChange={(e) =>
                onChange({
                  settings: {
                    label: e.target.value === '' ? undefined : e.target.value,
                  },
                })
              }
              style={{
                padding: '4px 8px',
                background: 'var(--bg-0)',
                border: '1px solid var(--panel-border)',
                borderRadius: 'var(--r-xs)',
                color: 'var(--fg-0)',
                fontSize: 12,
              }}
            />
          </SettingsField>

          <button
            type="button"
            onClick={onRemove}
            data-testid="meters-remove-widget"
            style={{
              marginTop: 8,
              padding: '6px 10px',
              background: 'transparent',
              border: '1px solid var(--tx)',
              borderRadius: 'var(--r-xs)',
              color: 'var(--tx)',
              fontSize: 11,
              fontFamily: 'var(--font-sans)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Trash2 size={12} />
            Remove widget
          </button>
        </div>
      ) : (
        <div style={{ padding: 16, fontSize: 11, color: 'var(--fg-2)' }}>
          Select a widget to configure it.
        </div>
      )}
    </div>
  );
}

function SettingsField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          fontSize: 9,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--fg-2)',
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      value={isFinite(value) ? value : 0}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      style={{
        padding: '4px 8px',
        background: 'var(--bg-0)',
        border: '1px solid var(--panel-border)',
        borderRadius: 'var(--r-xs)',
        color: 'var(--fg-0)',
        fontSize: 12,
        width: '100%',
      }}
    />
  );
}

// Re-export so tests can use the parser without a TabNode
export { parseMetersPanelConfig };
