# Configuración de Recomendaciones con IA

## Descripción
Esta nueva funcionalidad permite a los usuarios especificar dónde estarán cada día durante su viaje y obtener recomendaciones personalizadas usando inteligencia artificial.

## Características
- **Ubicaciones por día**: Especifica dónde estarás cada día del viaje
- **Recomendaciones IA**: Obtén sugerencias de restaurantes, atracciones, actividades, museos, vida nocturna y compras
- **Integración con itinerario**: Funciona junto con la sección de itinerario existente
- **Información detallada**: Cada recomendación incluye dirección, horarios, precios, y razón de la recomendación

## Configuración de Base de Datos

1. Ejecuta el script SQL para crear las nuevas tablas:
```bash
# Conecta a tu base de datos Supabase y ejecuta:
psql -h your-supabase-host -U postgres -d postgres -f scripts/026-add-ai-recommendations.sql
```

O copia y pega el contenido del archivo `scripts/026-add-ai-recommendations.sql` en el editor SQL de Supabase.

## Configuración de Variables de Entorno

Agrega las siguientes variables a tu archivo `.env`:

```env
# Configuración de OpenAI para Recomendaciones IA
OPENAI_API_KEY=tu_api_key_de_openai_aqui
```

### Obtener API Key de OpenAI

1. Ve a [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Inicia sesión o crea una cuenta
3. Haz clic en "Create new secret key"
4. Copia la clave y agrégala a tu archivo `.env`

## Nuevas Tablas Creadas

### `trip_locations`
Almacena las ubicaciones por día de cada viaje:
- Fecha específica
- Ubicación/lugar
- Ciudad y país opcionales
- Notas del usuario

### `ai_recommendations`
Almacena las recomendaciones generadas por IA:
- Categoría (restaurantes, atracciones, etc.)
- Información detallada (dirección, horarios, precios)
- Razón de la recomendación
- Enlaces y contactos

## Uso de la Funcionalidad

1. **Acceder**: Ve al detalle de un viaje y haz clic en la pestaña "Recomendaciones IA"
2. **Agregar ubicación**: Haz clic en "Agregar Ubicación" y especifica:
   - Fecha
   - Ubicación específica
   - Ciudad y país (opcional)
   - Notas sobre preferencias
3. **Generar recomendaciones**: Haz clic en "Generar Recomendaciones" para obtener sugerencias de IA
4. **Explorar**: Navega por las diferentes categorías de recomendaciones

## Categorías de Recomendaciones

- **Restaurantes**: Lugares para comer y beber
- **Atracciones**: Sitios turísticos y lugares de interés
- **Actividades**: Experiencias y tours
- **Museos**: Museos y galerías de arte
- **Vida Nocturna**: Bares, clubs y entretenimiento nocturno
- **Compras**: Tiendas, mercados y centros comerciales

## Personalización

Las recomendaciones se generan considerando:
- Ubicación específica
- Fecha del viaje
- Título del viaje (contexto)
- Notas y preferencias del usuario
- Información en tiempo real sobre los lugares

## Costos

- Esta funcionalidad utiliza la API de OpenAI
- Se recomienda el modelo `gpt-4o-mini` para equilibrar costo y calidad
- Cada generación de recomendaciones cuesta aproximadamente $0.01-0.03 USD

## Solución de Problemas

### Error: "OpenAI API key not configured"
- Verifica que `OPENAI_API_KEY` esté configurado en tu archivo `.env`
- Reinicia tu servidor de desarrollo después de agregar la variable

### Error: "Failed to generate recommendations"
- Verifica tu conexión a internet
- Comprueba que tu API key de OpenAI sea válida y tenga créditos
- Revisa los logs del servidor para más detalles

### Las tablas no existen
- Ejecuta el script SQL `scripts/026-add-ai-recommendations.sql`
- Verifica que las políticas RLS estén configuradas correctamente

## Archivos Creados/Modificados

- `scripts/026-add-ai-recommendations.sql` - Script de base de datos
- `components/trip-ai-recommendations.tsx` - Componente principal
- `app/api/generate-recommendations/route.ts` - Endpoint API
- `app/trips/[id]/page.tsx` - Página principal del viaje (modificada)
- `package.json` - Dependencia OpenAI agregada 