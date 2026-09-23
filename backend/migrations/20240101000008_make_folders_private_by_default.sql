-- Folders used to inherit the project's visibility when created. A folder created while its
-- project was public stayed public after the project was made private, leaking its files.
--
-- Access is now: public project -> everything public; private project -> only folders
-- explicitly made public. Reset every folder to private so no inherited flag survives.
-- This fails closed: a folder deliberately made public via the API needs to be made public again.
UPDATE folders SET is_public = FALSE WHERE is_public = TRUE;
