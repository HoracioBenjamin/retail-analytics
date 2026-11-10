// @vitest-environment jsdom
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SearchableSelect } from './SearchableSelect'

afterEach(cleanup)

describe('SearchableSelect', () => {
  it('busca sin acentos, selecciona con teclado y conserva la selección al buscar', () => {
    const onValueChange = vi.fn()
    render(
      createElement(SearchableSelect, {
        label: 'Modelos',
        value: 'a',
        onValueChange,
        options: [
          { value: 'a', label: 'Clásico rojo' },
          { value: 'b', label: 'Deportivo azul' }
        ]
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Modelos' }))
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'DEPORTIVO' } })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Modelos' }).textContent).toContain('Clásico rojo')
    fireEvent.change(input, { target: { value: 'clasico' } })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onValueChange).toHaveBeenCalledWith('a')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('pagina 120 opciones, busca en todas las páginas y reinicia la búsqueda al abrir', () => {
    render(
      createElement(SearchableSelect, {
        label: 'Variantes',
        value: '0',
        onValueChange: vi.fn(),
        options: Array.from({ length: 120 }, (_, index) => ({
          value: String(index),
          label: 'Variante ' + index
        }))
      })
    )
    const trigger = screen.getByRole('button', { name: 'Variantes' })
    fireEvent.click(trigger)
    expect(screen.getAllByRole('option')).toHaveLength(50)
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('status').textContent).toContain('2/3')
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getAllByRole('option')).toHaveLength(20)
    expect(screen.getByRole('button', { name: 'Siguiente' }).hasAttribute('disabled')).toBe(true)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Variante 119' } })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull()
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })
    fireEvent.click(trigger)
    expect(screen.getAllByRole('option')).toHaveLength(50)
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('')
  })

  it('no cambia el filtro cuando no hay resultados y permite seleccionar con ratón', () => {
    const onValueChange = vi.fn()
    render(
      createElement(SearchableSelect, {
        label: 'Colores',
        value: 'all',
        onValueChange,
        options: [
          { value: 'all', label: 'Todos los colores' },
          { value: 'red', label: 'Rojo' }
        ]
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Colores' }))
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'inexistente' } })
    expect(screen.getByText('Sin resultados')).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onValueChange).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'Rojo' } })
    fireEvent.click(screen.getByRole('option', { name: 'Rojo' }))
    expect(onValueChange).toHaveBeenCalledWith('red')
  })
})
