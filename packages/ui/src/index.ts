// The package's public surface (design D1): the seven components the admin
// pages use, their parts and variants, and the class-name helper. Each
// component is plain markup plus Tailwind classes, so none renders a
// server-side `style` attribute that the strict CSP would block.
export {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  alertVariants,
  type AlertVariant,
} from "./components/ui/alert/index.ts";
export {
  Badge,
  badgeVariants,
  type BadgeVariant,
} from "./components/ui/badge/index.ts";
export {
  Button,
  buttonVariants,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from "./components/ui/button/index.ts";
export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/ui/card/index.ts";
export { Input } from "./components/ui/input/index.ts";
export { Label } from "./components/ui/label/index.ts";
export { Textarea } from "./components/ui/textarea/index.ts";
export { cn } from "./utils.ts";
