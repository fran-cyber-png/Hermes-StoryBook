import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  CeldaPersona,
  cabeceraQuieta,
  celdaDeCabecera,
  celdaQuieta,
  celdaQuietaDensa,
  tablaQuieta,
} from '../../components/TablaQuieta';
import { Bandera } from '../../components/Bandera';

/**
 * LA TABLA QUIETA — cómo se ve una tabla de datos en Hermes (ADR 0102).
 *
 * ⚠️ **No es un componente `<Tabla>`, son CLASES.** El padrón dibuja sus filas a
 * mano y la Lista del Pipeline con el `flexRender` de TanStack: un componente que
 * envolviera `<table>` no le serviría a ninguna sin volverse un segundo motor de
 * tabla. Lo que tiene que ser igual es cómo se VEN, y eso son unas pocas cadenas.
 *
 * Por eso esta historia dibuja una tabla de ejemplo: es la referencia visual del
 * sistema, no una API de componente.
 *
 * ⚠️ **Bordes separados, no colapsados**: con la cabecera pegajosa, el borde de
 * una tabla colapsada es de la TABLA y no de la celda — al hacer scroll la línea
 * de abajo del encabezado se queda atrás y las filas pasan por debajo sin corte.
 */
const meta = {
  title: 'Organismos/TablaQuieta',
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const FILAS = [
  { nombre: 'Andrea Quispe', correo: 'andrea.quispe@gmail.com', pais: ['PE', 'Perú'], etapa: 'Preguntó precio' },
  { nombre: 'Julián Loyola', correo: 'jloyola@outlook.com', pais: ['CO', 'Colombia'], etapa: 'Te esperan' },
  { nombre: 'Karina Tarazona', correo: 'ktarazona@gmail.com', pais: ['MX', 'México'], etapa: 'Cotizado' },
];

function Tabla({ densa }: { densa?: boolean }) {
  const celda = densa ? celdaQuietaDensa : celdaQuieta;
  return (
    <div className="max-h-72 overflow-auto rounded-xl border border-border">
      <table className={tablaQuieta}>
        <thead className={cabeceraQuieta}>
          <tr>
            <th className={celdaDeCabecera}>Persona</th>
            <th className={celdaDeCabecera}>País</th>
            <th className={celdaDeCabecera}>Etapa</th>
          </tr>
        </thead>
        <tbody>
          {FILAS.map((f) => (
            <tr key={f.correo}>
              <td className={celda}>
                <CeldaPersona nombre={f.nombre} detalle={densa ? undefined : f.correo} compacta={densa} />
              </td>
              <td className={celda}>
                <span className="flex items-center gap-1.5 text-sm">
                  <Bandera iso={f.pais[0]} nombre={f.pais[1]} />
                  {f.pais[1]}
                </span>
              </td>
              <td className={celda}>
                <span className="text-sm text-muted-foreground">{f.etapa}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Filas altas: una tabla que se LEE fila por fila (el padrón). */
export const Alta: Story = {
  name: 'Alta (el padrón — se lee fila por fila)',
  render: () => <Tabla />,
};

/**
 * Misma tabla, otra altura: a 720 px con la alta entran ~10 filas y con ésta 13.
 * Es para una lista de TRABAJO de cientos de filas (la Lista del Pipeline).
 */
export const Densa: Story = {
  name: 'Densa (la Lista del Pipeline — cientos de filas)',
  render: () => <Tabla densa />,
};
