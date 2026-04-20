declare module "@dnd-kit/core" {
  import type { ReactNode } from "react";

  export type UniqueIdentifier = string | number;

  export interface Active {
    id: UniqueIdentifier;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { current: Record<string, any> };
    rect: { current: { initial: DOMRect | null; translated: DOMRect | null } };
  }

  export interface Over {
    id: UniqueIdentifier;
    rect: DOMRect;
    disabled: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { current: Record<string, any> };
  }

  export interface DragStartEvent {
    active: Active;
    activatorEvent: Event;
  }

  export interface DragMoveEvent {
    active: Active;
    over: Over | null;
  }

  export interface DragOverEvent {
    active: Active;
    over: Over | null;
  }

  export interface DragEndEvent {
    active: Active;
    over: Over | null;
    activatorEvent: Event;
  }

  export interface DragCancelEvent {
    active: Active;
    over: Over | null;
  }

  export interface Announcements {
    onDragStart?: (event: DragStartEvent) => string;
    onDragMove?: (event: DragMoveEvent) => string;
    onDragOver?: (event: DragOverEvent) => string;
    onDragEnd?: (event: DragEndEvent) => string;
    onDragCancel?: (event: DragCancelEvent) => string;
  }

  export interface ScreenReaderInstructions {
    draggable: string;
  }

  export interface Accessibility {
    announcements?: Announcements;
    screenReaderInstructions?: ScreenReaderInstructions;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type CollisionDetection = (...args: any[]) => any[];

  export const closestCenter: CollisionDetection;
  export const closestCorners: CollisionDetection;
  export const rectIntersection: CollisionDetection;
  export const pointerWithin: CollisionDetection;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type Modifier = (args: any) => any;

  export interface DndContextProps {
    accessibility?: Accessibility;
    autoScroll?: boolean | Record<string, unknown>;
    children?: ReactNode;
    collisionDetection?: CollisionDetection;
    id?: string;
    modifiers?: Modifier[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sensors?: any[];
    onDragStart?: (event: DragStartEvent) => void;
    onDragMove?: (event: DragMoveEvent) => void;
    onDragOver?: (event: DragOverEvent) => void;
    onDragEnd?: (event: DragEndEvent) => void;
    onDragCancel?: (event: DragCancelEvent) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }

  export function DndContext(props: DndContextProps): JSX.Element;

  export interface DragOverlayProps {
    adjustScale?: boolean;
    children?: ReactNode;
    className?: string;
    dropAnimation?: DropAnimation | Record<string, unknown> | null;
    style?: React.CSSProperties;
    transition?: string;
    modifiers?: Modifier[];
    wrapperElement?: keyof JSX.IntrinsicElements;
    zIndex?: number;
  }

  export function DragOverlay(props: DragOverlayProps): JSX.Element;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function useSensor(sensor: any, options?: any): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function useSensors(...sensors: any[]): any[];

  export const KeyboardSensor: unknown;
  export const MouseSensor: unknown;
  export const PointerSensor: unknown;
  export const TouchSensor: unknown;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function useDndMonitor(handlers: Record<string, any>): void;

  export interface UseDraggableArguments {
    id: UniqueIdentifier;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    disabled?: boolean | Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attributes?: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function useDraggable(args: UseDraggableArguments): any;

  export interface UseDroppableArguments {
    id: UniqueIdentifier;
    disabled?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resizeObserverConfig?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function useDroppable(args: UseDroppableArguments): any;

  export const defaultDropAnimationSideEffects: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: any
  ) => // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any;

  export type MeasuringStrategy = Record<string, unknown>;

  export type ClientRect = DOMRect;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type DraggableAttributes = Record<string, any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type DraggableSyntheticListeners = Record<string, any> | undefined;

  export interface DropAnimation {
    duration?: number;
    easing?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sideEffects?: (args: any) => any;
  }
}
