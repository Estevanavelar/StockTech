// Gera URL de login no App Portal com redirect de volta para o StockTech
export const getLoginUrl = () => {
  const portalUrl = "https://app.avelarcompany.com.br";

  const redirectUri = window.location.href;
  const url = new URL("/login", portalUrl);
  url.searchParams.set("redirect", redirectUri);

  return url.toString();
};
