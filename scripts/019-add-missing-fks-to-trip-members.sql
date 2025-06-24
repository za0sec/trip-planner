-- Add Foreign Key constraint for trip_id referencing trips(id)
ALTER TABLE public.trip_members
ADD CONSTRAINT trip_members_trip_id_fkey
FOREIGN KEY (trip_id)
REFERENCES public.trips(id)
ON DELETE CASCADE;

-- Add Foreign Key constraint for user_id referencing profiles(id)
ALTER TABLE public.trip_members
ADD CONSTRAINT trip_members_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Add Foreign Key constraint for invited_by referencing profiles(id)
ALTER TABLE public.trip_members
ADD CONSTRAINT trip_members_invited_by_fkey
FOREIGN KEY (invited_by)
REFERENCES public.profiles(id)
ON DELETE SET NULL;
