import { createPublicPropertyLink } from './api';

export async function copyTemporaryPropertyLink(type, propertyId, label) {
  const result = await createPublicPropertyLink(type, propertyId);
  const route = type === 'loteamento' ? 'loteamento' : 'imovel';
  const url = `${window.location.origin}/${route}/${result.token}`;
  try {
    await navigator.clipboard.writeText(url);
    window.alert(`Link publico de ${label} copiado.\n\nEle ficara disponivel por 7 dias.`);
  } catch {
    window.prompt('Copie o link publico (valido por 7 dias):', url);
  }
  return result;
}
