SELECT 'corinthians' AS tabela, COUNT(*) AS registros FROM public.corinthians
UNION ALL
SELECT 'palmeiras', COUNT(*) FROM public.palmeiras
UNION ALL
SELECT 'santos', COUNT(*) FROM public.santos
UNION ALL
SELECT 'saopaulo', COUNT(*) FROM public.saopaulo
ORDER BY tabela;

SELECT
    (SELECT COUNT(*) FROM public.corinthians)
  + (SELECT COUNT(*) FROM public.palmeiras)
  + (SELECT COUNT(*) FROM public.santos)
  + (SELECT COUNT(*) FROM public.saopaulo) AS total_registros;

