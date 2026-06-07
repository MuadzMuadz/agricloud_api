// Bentuk paginator ala Laravel (LengthAwarePaginator) untuk ResourceCollection.
// FE hanya memakai `data`, tapi `links`/`meta` disertakan demi parity.
export function paginate(
  items: Record<string, unknown>[],
  total: number,
  perPage: number,
  page: number,
  path: string,
): Record<string, unknown> {
  const lastPage = Math.max(1, Math.ceil(total / perPage))
  const from = total === 0 ? null : (page - 1) * perPage + 1
  const to = total === 0 ? null : from! + items.length - 1
  const pageUrl = (p: number) => `${path}?page=${p}`

  const links: Array<{ url: string | null; label: string; page: number | null; active: boolean }> = [
    { url: page > 1 ? pageUrl(page - 1) : null, label: '&laquo; Previous', page: page > 1 ? page - 1 : null, active: false },
  ]
  for (let p = 1; p <= lastPage; p++) {
    links.push({ url: pageUrl(p), label: String(p), page: p, active: p === page })
  }
  links.push({ url: page < lastPage ? pageUrl(page + 1) : null, label: 'Next &raquo;', page: page < lastPage ? page + 1 : null, active: false })

  return {
    data: items,
    links: {
      first: pageUrl(1),
      last: pageUrl(lastPage),
      prev: page > 1 ? pageUrl(page - 1) : null,
      next: page < lastPage ? pageUrl(page + 1) : null,
    },
    meta: {
      current_page: page,
      from,
      last_page: lastPage,
      links,
      path,
      per_page: perPage,
      to,
      total,
    },
  }
}
