import  Providers  from "@/redux/Provider";
export default function FullWidthPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div>
    <Providers>

    {children}
    </Providers>
    </div>;
}
