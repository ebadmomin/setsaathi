# SetSaathi project rules

## UI parity is required

The member website and admin console are two surfaces of one product. For every UI fix or visual upgrade, inspect both surfaces and apply the shared design change to both in the same task. Do not declare a UI task complete after changing only one surface.

Keep these consistent across both: color tokens, typography, contrast, spacing, radii, borders, background treatment, hover and focus states, motion, responsive behavior, and reduced-motion behavior. Prefer a shared style or token when the treatment is identical. Preserve role-specific layouts and functions where the content differs.

Before finishing a UI task:

1. Check the member view and admin view at desktop and mobile widths.
2. Check normal, hover, selected, focus, empty, loading, and error states that the change affects.
3. Run `npm run build` and report any view that could not be checked.

Do not put secrets, local databases, generated `dist/`, or `node_modules` in Git.


## Account and commit identity

Use only the GitHub account `ebadmomin` belonging to Ebad Momin for this repository. Before any GitHub write or push, verify the signed-in account is `ebadmomin` and the commit author is `Ebad Momin <ebadarmanmomin@gmail.com>`. Never use another person’s account, credentials, token, or Git author identity. If the correct identity is unavailable, stop the GitHub action and ask Ebad to sign in. Do not touch other accounts or repositories.
