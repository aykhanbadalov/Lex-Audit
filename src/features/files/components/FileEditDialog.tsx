import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useUpdateFile, type FileRecord } from "../api";
import { normalizeFolder, parseTags } from "../folder";

interface FileEditDialogProps {
  file: FileRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FileEditDialog({ file, open, onOpenChange }: FileEditDialogProps) {
  const { t } = useTranslation();
  const update = useUpdateFile(file.id);

  const schema = z.object({
    name: z
      .string()
      .trim()
      .min(1, { error: t("files.edit.nameRequired") })
      .max(255, { error: t("files.edit.nameTooLong") })
      .refine((value) => !value.includes("/"), { error: t("files.edit.nameSlash") }),
    folder: z.string().refine((value) => normalizeFolder(value) !== null, { error: t("files.edit.folderInvalid") }),
    tags: z
      .string()
      .refine((value) => parseTags(value).length <= 10, { error: t("files.edit.tagsTooMany") })
      .refine((value) => parseTags(value).every((tag) => tag.length <= 30), { error: t("files.edit.tagTooLong") }),
  });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: file.name, folder: file.folder, tags: file.tags.join(", ") },
  });

  async function onSubmit(values: FormValues) {
    try {
      await update.mutateAsync({
        name: values.name.trim(),
        folder: normalizeFolder(values.folder) ?? "/",
        tags: parseTags(values.tags),
      });
      onOpenChange(false);
    } catch {
      // The hook already showed an error toast; keep the dialog open so nothing typed is lost.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("files.edit.title")}</DialogTitle>
          <DialogDescription>{t("files.edit.description")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="file-name">{t("files.edit.name")}</Label>
            <Input id="file-name" aria-invalid={Boolean(errors.name)} {...register("name")} />
            {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="file-folder">{t("files.edit.folder")}</Label>
            <Input id="file-folder" aria-invalid={Boolean(errors.folder)} {...register("folder")} />
            {errors.folder ? <p className="text-xs text-destructive">{errors.folder.message}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="file-tags">{t("files.edit.tags")}</Label>
            <Input id="file-tags" aria-invalid={Boolean(errors.tags)} {...register("tags")} />
            <p className="text-xs text-muted-foreground">{t("files.edit.tagsHint")}</p>
            {errors.tags ? <p className="text-xs text-destructive">{errors.tags.message}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
