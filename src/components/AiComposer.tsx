import { useId } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
export interface OutgoingImage {
  name: string;
  dataUrl: string;
}
interface Props {
  value: string;
  onValueChange: (v: string) => void;
  onSend: (v: string, image: OutgoingImage | null) => void;
  onEditLast: () => void;
  canEditLast: boolean;
  libraryOn: boolean;
  onToggleLibrary: () => void;
  busy: boolean;
  placeholder: string;
  className?: string;
}
export function AiComposer(p: Props) {
  const { t } = useI18n();
  const id = useId();
  return (
    <form
      className={p.className}
      onSubmit={(e) => {
        e.preventDefault();
        if (p.value.trim() && !p.busy) p.onSend(p.value.trim(), null);
      }}
    >
      <label htmlFor={id} className="block text-sm">
        {t("chat.placeholder")}
      </label>
      <textarea
        id={id}
        value={p.value}
        onChange={(e) => p.onValueChange(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder={p.placeholder}
        className="mt-2 w-full rounded-lg border border-border p-3"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="submit" disabled={!p.value.trim() || p.busy}>
          {t("chat.send")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={p.onEditLast}
          disabled={!p.canEditLast || p.busy}
        >
          {t("chat.edit")}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("chat.attachUnsupported")}</p>
    </form>
  );
}
