# TangSpark Website

Static site ready for GitHub Pages deployment and custom domain.

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. In GitHub: `Settings` -> `Pages`.
3. Under `Build and deployment`, set `Source` to `GitHub Actions`.
4. Push to `main` and wait for the `Deploy static site to GitHub Pages` workflow to finish.

## Custom domain (`tang-spark.no`)

This repo already includes a `CNAME` file with:

`tang-spark.no`

Set DNS records at your domain provider:

1. `A` record for `@` -> `185.199.108.153`
2. `A` record for `@` -> `185.199.109.153`
3. `A` record for `@` -> `185.199.110.153`
4. `A` record for `@` -> `185.199.111.153`
5. `CNAME` record for `www` -> `<your-github-username>.github.io`

Then in `Settings` -> `Pages`:

1. Confirm the custom domain is `tang-spark.no`
2. Enable `Enforce HTTPS` once DNS has propagated
