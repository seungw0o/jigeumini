import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </Svg>
);

export const SwapIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 4v15M4.5 7.5 8 4l3.5 3.5M16 20V5M12.5 16.5 16 20l3.5-3.5" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const BackIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 5 7 7-7 7" />
  </Svg>
);

export const LocateIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <path d="M12 2.5V6M12 18v3.5M2.5 12H6M18 12h3.5" />
  </Svg>
);

export const LayersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4 3 8.5l9 4.5 9-4.5L12 4Z" />
    <path d="m3 12.5 9 4.5 9-4.5M3 16.5 12 21l9-4.5" />
  </Svg>
);

export const BusIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="3.5" width="14" height="15" rx="2.5" />
    <path d="M5 11h14M8 18.5V21M16 18.5V21" />
    <circle cx="8.5" cy="14.8" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="14.8" r="0.9" fill="currentColor" stroke="none" />
  </Svg>
);

export const WalkIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="13" cy="4.5" r="1.8" />
    <path d="m9.5 21 2.2-6.5L14 17v4M11.7 14.5l.8-5.5-3 1.8L8 14M12.5 9l2.3 2.6 2.7.9" />
  </Svg>
);

export const BellIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15L6 16.5ZM10 20.5a2.2 2.2 0 0 0 4 0" />
  </Svg>
);

export const BellOffIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.2 6.2A6 6 0 0 1 18 11v4.5M6 11v5.5L4.5 18H17M10 20.5a2.2 2.2 0 0 0 4 0M3.5 3.5l17 17" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const RefreshIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" />
  </Svg>
);

export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const PinIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </Svg>
);

export const AlertIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4 2.8 19.5h18.4L12 4Z" />
    <path d="M12 10v4.2M12 17h.01" />
  </Svg>
);

export const LocationOffIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.6 5.2A6.5 6.5 0 0 1 18.5 10c0 1.6-.6 3.2-1.4 4.6M14.6 18.3C13.2 19.9 12 21 12 21s-6.5-5.6-6.5-11c0-.7.1-1.4.3-2M3.5 3.5l17 17" />
  </Svg>
);

export const MapOffIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 4-5.5 2v14L9 18l6 2 5.5-2V4L15 6 9 4ZM9 4v14M15 6v14" />
  </Svg>
);

export const HistoryIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4.5v3.8h3.8M12 8v4.3l2.8 1.7" />
  </Svg>
);

export const TransferIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
  </Svg>
);
