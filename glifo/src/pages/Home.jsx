import { lazy, Suspense } from 'react';
import Hero from '../components/sections/Hero';

// Todas las secciones below-the-fold se cargan en paralelo pero no bloquean el Hero
const Features      = lazy(() => import('../components/sections/Features'));
const Ingesta       = lazy(() => import('../components/sections/Ingesta'));
const Buscador      = lazy(() => import('../components/sections/Buscador'));
const KnowledgeGraph = lazy(() => import('../components/sections/KnowledgeGraph'));
const ApiExplorer   = lazy(() => import('../components/sections/ApiExplorer'));
const DemoFlow      = lazy(() => import('../components/sections/DemoFlow'));
const Architecture  = lazy(() => import('../components/sections/Architecture'));
const Datasets      = lazy(() => import('../components/sections/Datasets'));
const Demo          = lazy(() => import('../components/sections/Demo'));

// Placeholder mínimo mientras carga una sección
function SectionSkeleton() {
  return (
    <div style={{
      minHeight: 120,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }} aria-hidden="true" />
  );
}

export default function Home() {
  return (
    <main>
      <Hero />
      <Suspense fallback={<SectionSkeleton />}><Features /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><Ingesta /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><Buscador /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><KnowledgeGraph /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><ApiExplorer /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><DemoFlow /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><Architecture /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><Datasets /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><Demo /></Suspense>
    </main>
  );
}
