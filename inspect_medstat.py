import itertools, pathlib
files=['medstat_atc_code_data.txt','medstat_atc_code_text.txt']
for f in files:
    p=pathlib.Path(f)
    with p.open('r',encoding='utf-8',errors='replace') as fh:
        first5=list(itertools.islice(fh,5))
    with p.open('r',encoding='utf-8',errors='replace') as fh:
        n=sum(1 for _ in fh)
    first=first5[0].rstrip('\n\r') if first5 else ''
    delim=';' if first.count(';')>=max(first.count('\t'),first.count(','),first.count('|')) else 'unknown'
    print(f'=== {f} first 5 lines ===')
    for line in first5:
        print(line.rstrip('\n\r'))
    print(f'{f} => approx_lines={n}, delimiter={delim}, semicolons_in_line1={first.count(";")}')
    print()
