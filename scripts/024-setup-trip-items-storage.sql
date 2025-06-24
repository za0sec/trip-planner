-- Asegúrate de que RLS esté habilitado para storage.objects en tu panel de Supabase.

-- Política: Permitir acceso público de lectura a los archivos en el bucket "trip-items"
CREATE POLICY "Public Trip Items Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'trip-items' ); -- Corregido a trip-items

-- Política: Permitir a los usuarios autenticados subir archivos al bucket "trip-items".
CREATE POLICY "Authenticated Users Can Upload Trip Items"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'trip-items' ); -- Corregido a trip-items

-- Política: Permitir a los usuarios autenticados actualizar sus propios archivos en "trip-items".
-- Asume que la ruta del archivo comienza con el user_id del propietario.
CREATE POLICY "Users Can Update Own Trip Items"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trip-items' AND -- Corregido a trip-items
  auth.uid()::text = split_part(name, '/', 1)
)
WITH CHECK (
  bucket_id = 'trip-items' AND -- Corregido a trip-items
  auth.uid()::text = split_part(name, '/', 1)
);

-- Política: Permitir a los usuarios autenticados eliminar sus propios archivos en "trip-items".
CREATE POLICY "Users Can Delete Own Trip Items"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'trip-items' AND -- Corregido a trip-items
  auth.uid()::text = split_part(name, '/', 1)
);
