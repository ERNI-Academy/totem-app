declare module "@tabler/icons-react" {
  import type { SVGProps } from "react";
  type IconProps = SVGProps<SVGSVGElement> & { size?: number | string; stroke?: number | string };
  type IconComponent = (props: IconProps) => React.ReactElement;
  export const IconDeviceTv: IconComponent;
  export const IconUsers: IconComponent;
  export const IconTemplate: IconComponent;
  export const IconPhoto: IconComponent;
  export const IconPlus: IconComponent;
  export const IconSearch: IconComponent;
  export const IconCopy: IconComponent;
  export const IconTrash: IconComponent;
  export const IconLock: IconComponent;
  export const IconLockOpen: IconComponent;
  export const IconArrowLeft: IconComponent;
  export const IconArrowRight: IconComponent;
  export const IconEye: IconComponent;
  export const IconDeviceFloppy: IconComponent;
  export const IconSend: IconComponent;
  export const IconLogout: IconComponent;
  export const IconLayersIntersect: IconComponent;
  export const IconChevronDown: IconComponent;
  export const IconLayoutDashboard: IconComponent;
}
