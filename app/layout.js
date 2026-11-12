import '@fontsource-variable/inter';
import './globals.css';

export const metadata = {
  title: { default: 'ProfQuiz, Teste interactive gratuite pentru profesori', template: '%s, ProfQuiz' },
  description:
    'ProfQuiz este o platformă gratuită pentru profesorii din Republica Moldova: creați teste cu imagini și șase tipuri de întrebări, jucați-le live la clasă și urmăriți rezultatele fiecărui elev.',
  applicationName: 'ProfQuiz',
  openGraph: { title: 'ProfQuiz', description: 'Teste interactive gratuite pentru fiecare lecție.', locale: 'ro_MD', type: 'website' },
};

export const viewport = { themeColor: '#10132B', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
