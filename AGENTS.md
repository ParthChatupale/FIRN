<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting published git history — force pushing, or rebasing/amending/squashing commits that are already pushed — as it rewrites history on Lovable's side and the user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- FIRN keeps predefined station/scenario data in a pure TypeScript module and shares selected simulation state across routes through a React provider, so future optimization logic can replace the mock engine without changing page presentation.
- All FIRN screens use distinct TanStack routes inside one shared shell, so navigation retains the same simulated station state and each view has a shareable URL.
