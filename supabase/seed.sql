insert into public.tenants (name, slug)
values ('Ikamva Business Solutions', 'ikamva-business-solutions')
on conflict (slug) do nothing;
