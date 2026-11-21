-- Physiological readings and smartwatch vital monitoring have been removed.
-- Preserve incident history, but prevent old saved settings from firing a
-- vital-sign trigger in a future alert configuration.
UPDATE public.alert_settings
SET triggers = array_remove(triggers, 'vital'), updated_at = now()
WHERE 'vital' = ANY(triggers);
