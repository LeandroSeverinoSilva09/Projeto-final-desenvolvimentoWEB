interface HeaderProps { title: string; subtitle?: string; showLogout?: boolean }
export function Header({ title, subtitle }: HeaderProps) { return <div className="page-heading"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div></div> }
