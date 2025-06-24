-- Asegúrate de que RLS esté habilitado para la tabla storage.objects en tu dashboard de Supabase.

-- Política: Permitir acceso público de lectura a los archivos en el bucket "avatars"
CREATE POLICY "Public Avatars Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- Política: Permitir a los usuarios autenticados subir su propio avatar.
-- El nombre del archivo en storage será el user_id (más extensión).
CREATE POLICY "User Can Upload Own Avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = regexp_replace(name, '\.[^.]+$', '') -- Compara el user_id con el nombre del archivo sin extensión
);

-- Política: Permitir a los usuarios autenticados actualizar (reemplazar) su propio avatar.
CREATE POLICY "User Can Update Own Avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = regexp_replace(name, '\.[^.]+$', '')
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = regexp_replace(name, '\.[^.]+$', '')
);

-- Política: Permitir a los usuarios autenticados eliminar su propio avatar.
CREATE POLICY "User Can Delete Own Avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = regexp_replace(name, '\.[^.]+$', '')
);
