import csv
import argparse
import os

def time_to_seconds(time_str):
    """Convert time format (minutes:seconds.milliseconds) to seconds."""
    if not time_str:
        return 0
    minutes, seconds = time_str.split(':')
    seconds, milliseconds = map(float, seconds.split('.'))
    total_seconds = int(minutes) * 60 + seconds + milliseconds / 1000  # Convert to total seconds
    return total_seconds

def format_time(time_str):
    """Return the time string as is, since we want to keep the same format."""
    return time_str.strip()  # Just return the original time string

def convert_reaper_to_audition(reaper_csv_path, audition_csv_path):
    with open(reaper_csv_path, 'r') as reaper_file:
        reader = csv.reader(reaper_file)
        next(reader)  # Skip header

        markers = []
        for row in reader:
            if row[0].startswith('M') or row[0].startswith('R'):  # Check for Markers or Regions
                name = row[1]
                start_time = row[2]
                end_time = row[3] if len(row) > 3 else ''
                length_time = row[4] if len(row) > 4 else ''

                # Use the original start time for output
                formatted_start_time = format_time(start_time)

                # Calculate duration only if end_time is provided
                if end_time:
                    end_seconds = time_to_seconds(end_time)
                    start_seconds = time_to_seconds(start_time)
                    duration_seconds = end_seconds - start_seconds
                    formatted_duration_time = format_time(f"{int(duration_seconds // 60)}:{int(duration_seconds % 60):02}.{int((duration_seconds - int(duration_seconds)) * 1000):03}")
                else:
                    formatted_duration_time = "0:00.000"  # Default to 0 if no end time

                markers.append({
                    'Name': name,
                    'Start': formatted_start_time,
                    'Duration': formatted_duration_time,
                    'Type': 'Cue',
                    'Description': ''
                })

    # Write to Audition CSV with whitespace as delimiter
    with open(audition_csv_path, 'w', newline='') as audition_file:
        # Write header
        audition_file.write("Name\tStart\tDuration\tTime Format\tType\tDescription\n")
        
        for marker in markers:
            audition_file.write(f"{marker['Name']}\t{marker['Start']}\t{marker['Duration']}\tdecimal\t{marker['Type']}\t{marker['Description']}\n")

def main():
    parser = argparse.ArgumentParser(description='Convert Reaper CSV to Audition CSV format.')
    parser.add_argument('reaper_csv', type=str, help='Path to the Reaper CSV file')
    args = parser.parse_args()

    reaper_csv_path = args.reaper_csv
    audition_csv_path = os.path.join(os.path.dirname(reaper_csv_path), 'AUDITION_' + os.path.basename(reaper_csv_path))

    convert_reaper_to_audition(reaper_csv_path, audition_csv_path)
    print(f'Converted {reaper_csv_path} to {audition_csv_path}')

if __name__ == '__main__':
    main()

